import { NextResponse } from "next/server";
import { generateAbilityPlan, generateStageOpening } from "@/lib/ai";
import { assertCandidateToken, jsonError, readJson, tokenFromRequest } from "@/lib/apiUtils";
import { updateCandidate } from "@/lib/repositories/candidates";
import { listAgents } from "@/lib/repositories/agents";
import { addEvent } from "@/lib/repositories/events";
import { listJobRoles } from "@/lib/repositories/jobRoles";
import { addMessage, listMessages } from "@/lib/repositories/messages";
import { createStage, getActiveStage, getNextStage, listStages, resetStages, updateStage } from "@/lib/repositories/stages";
import { stageDurations } from "@/lib/stages";
import { Stage, StageName } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ candidate_token?: string }>(request);
    const candidate = await assertCandidateToken(params.id, tokenFromRequest(request, body));
    await ensureStageFlow(params.id);

    let current = await getActiveStage(params.id);
    if (!current) {
      const first = await getNextStage(params.id);
      if (!first) return NextResponse.json({ error: "stage_transition_unavailable", message: "没有可启动的关卡。" }, { status: 400 });
      current = await startStage(first);
    }

    const [agents, jobRoles] = await Promise.all([listAgents(), listJobRoles()]);
    const jobRole = jobRoles.find((job) => job.name === candidate.target_role) ?? jobRoles[0];
    if (!jobRole) return NextResponse.json({ error: "job_role_not_configured", message: "岗位配置不存在。" }, { status: 400 });

    let abilityPlan = candidate.ability_plan;
    if (!abilityPlan) {
      await addEvent({
        candidate_id: params.id,
        stage_id: current.id,
        event_type: "ability_plan_generation_started",
        raw_content: "Calling DeepSeek to generate ability plan before stage opening.",
        ai_summary: "正在调用 DeepSeek 生成动态能力维度和 Agent 参与策略。"
      });
      abilityPlan = await generateAbilityPlan({
        provider: "deepseek",
        targetRole: candidate.target_role ?? jobRole.name,
        targetDifficulty: candidate.target_difficulty ?? jobRole.difficulty,
        personaProfile: candidate.persona_profile,
        agents,
        fallbackDimensions: jobRole.ability_dimensions
      });
      await updateCandidate(candidate.id, { ability_plan: abilityPlan });
      await addEvent({
        candidate_id: params.id,
        stage_id: current.id,
        event_type: "ability_plan_generated",
        raw_content: JSON.stringify(abilityPlan),
        ai_summary: "已生成动态能力维度和 Agent 参与策略。"
      });
    }

    if (current.name === "面试关卡准备") {
      await updateStage(current.id, { status: "completed", completed_at: new Date().toISOString() });
      const basic = await getStageByName(params.id, "基础关卡");
      if (!basic) return NextResponse.json({ error: "basic_stage_missing", message: "基础关卡未初始化。" }, { status: 400 });
      const startedBasic = await startStage(basic);
      const message = await generateAndPersistOpening({
        candidateId: params.id,
        candidate: { ...candidate, ability_plan: abilityPlan },
        stage: startedBasic,
        agents,
        jobRole,
        selectedModel: candidate.selected_model ?? "deepseek"
      });
      return NextResponse.json({ stage: startedBasic, message });
    }

    const messages = await listMessages(params.id);
    const currentHasQuestion = messages.some((message) => message.stage_id === current.id && message.role === "ai");
    if (!currentHasQuestion) {
      const message = await generateAndPersistOpening({
        candidateId: params.id,
        candidate: { ...candidate, ability_plan: abilityPlan },
        stage: current,
        agents,
        jobRole,
        selectedModel: candidate.selected_model ?? "deepseek"
      });
      return NextResponse.json({ stage: current, message, repaired: true });
    }

    const next = await getNextStage(params.id);
    if (!next) return NextResponse.json({ error: "stage_transition_unavailable", message: "已经没有下一关，请提交最终方案。" }, { status: 400 });

    await updateStage(current.id, { status: "completed", completed_at: new Date().toISOString() });
    const startedStage = await startStage(next);
    const message = await generateAndPersistOpening({
      candidateId: params.id,
      candidate: { ...candidate, ability_plan: abilityPlan },
      stage: startedStage,
      agents,
      jobRole,
      selectedModel: candidate.selected_model ?? "deepseek"
    });
    return NextResponse.json({ stage: startedStage, message });
  } catch (error) {
    return jsonError(error, "stage_advance_failed");
  }
}

async function generateAndPersistOpening(input: {
  candidateId: string;
  candidate: any;
  stage: Stage;
  agents: Awaited<ReturnType<typeof listAgents>>;
  jobRole: Awaited<ReturnType<typeof listJobRoles>>[number];
  selectedModel: "deepseek" | "openai";
}) {
  await addEvent({
    candidate_id: input.candidateId,
    stage_id: input.stage.id,
    event_type: "stage_question_generation_started",
    raw_content: `Generating opening question for ${input.stage.name}`,
    ai_summary: "正在调用模型生成本关首题。"
  });
  const opening = await generateStageOpening({
    provider: input.selectedModel,
    candidate: input.candidate,
    stage: input.stage,
    targetRole: input.candidate.target_role ?? input.jobRole.name,
    targetDifficulty: input.candidate.target_difficulty ?? input.jobRole.difficulty,
    abilityDimensions: input.jobRole.ability_dimensions
  });
  const agent = input.agents.find((item) => item.status === "enabled" && item.agent_role === "lead_examiner") ?? input.agents[0];
  const message = await addMessage({
    candidate_id: input.candidateId,
    stage_id: input.stage.id,
    role: "ai",
    ai_role: "examiner",
    model_provider: input.selectedModel,
    agent_id: agent?.id,
    content: opening.question
  });
  await addEvent({
    candidate_id: input.candidateId,
    stage_id: input.stage.id,
    event_type: input.stage.name === "能力关卡" ? "pressure_added" : "ai_question",
    raw_content: message.content,
    ai_summary: JSON.stringify(opening),
    risk_tags: input.stage.name === "能力关卡" ? ["时间限制", "工程资源限制", "证据留痕限制"] : []
  });
  return message;
}

async function ensureStageFlow(candidateId: string) {
  const stages = await listStages(candidateId);
  if (stages.length === 0) {
    await createDefaultStages(candidateId);
    return;
  }

  const normalized = stages.map((stage) => ({ ...stage, normalizedName: normalizeStageName(String(stage.name)) }));
  const hasPrep = normalized.some((stage) => stage.normalizedName === "面试关卡准备");
  const hasBasic = normalized.some((stage) => stage.normalizedName === "基础关卡");
  const hasAbility = normalized.some((stage) => stage.normalizedName === "能力关卡");

  if (!hasPrep && !stages.some((stage) => stage.status === "in_progress")) {
    await createStage({ candidate_id: candidateId, name: "面试关卡准备", status: "in_progress", target_duration_seconds: 0, started_at: new Date().toISOString() });
  }
  if (!hasBasic) {
    await createStage({ candidate_id: candidateId, name: "基础关卡", status: "not_started", target_duration_seconds: stageDurations["基础关卡"] });
  }
  if (!hasAbility) {
    await createStage({ candidate_id: candidateId, name: "能力关卡", status: "not_started", target_duration_seconds: stageDurations["能力关卡"] });
  }
}

async function createDefaultStages(candidateId: string) {
  await resetStages(candidateId);
  await createStage({ candidate_id: candidateId, name: "面试关卡准备", status: "in_progress", target_duration_seconds: 0, started_at: new Date().toISOString() });
  await createStage({ candidate_id: candidateId, name: "基础关卡", status: "not_started", target_duration_seconds: stageDurations["基础关卡"] });
  await createStage({ candidate_id: candidateId, name: "能力关卡", status: "not_started", target_duration_seconds: stageDurations["能力关卡"] });
}

async function startStage(stage: Stage) {
  return updateStage(stage.id, {
    status: "in_progress",
    target_duration_seconds: stage.target_duration_seconds ?? stageDurations[normalizeStageName(String(stage.name))],
    started_at: new Date().toISOString()
  });
}

async function getStageByName(candidateId: string, name: StageName) {
  const stages = await listStages(candidateId);
  return stages.find((stage) => normalizeStageName(String(stage.name)) === name && stage.status !== "completed") ?? null;
}

function normalizeStageName(name: string): StageName {
  if (name === "基础关卡" || name.includes("基础")) return "基础关卡";
  if (name === "能力关卡" || name.includes("能力")) return "能力关卡";
  return "面试关卡准备";
}
