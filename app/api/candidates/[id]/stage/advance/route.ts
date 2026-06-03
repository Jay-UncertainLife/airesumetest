import { NextResponse } from "next/server";
import { generateAbilityPlan, generateStageOpening } from "@/lib/ai";
import { buildArenaProgress } from "@/lib/arenaProgress";
import { assertCandidateToken, jsonError, readJson, tokenFromRequest } from "@/lib/apiUtils";
import { listAgents } from "@/lib/repositories/agents";
import { updateCandidate } from "@/lib/repositories/candidates";
import { addEvent } from "@/lib/repositories/events";
import { listTurnScores } from "@/lib/repositories/evaluations";
import { listJobRoles } from "@/lib/repositories/jobRoles";
import { addMessage, listMessages } from "@/lib/repositories/messages";
import { completeOtherActiveStages, createStage, getActiveStage, getNextStage, listStages, resetStages, updateStage } from "@/lib/repositories/stages";
import { stageDurations } from "@/lib/stages";
import { ABILITY_STAGE, BASIC_STAGE, PREP_STAGE, normalizeStageName } from "@/lib/stageNames";
import { Candidate, Stage, StageName } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ candidate_token?: string }>(request);
    const candidate = await assertCandidateToken(params.id, tokenFromRequest(request, body));
    await ensureStageFlow(params.id);

    const [agents, jobRoles] = await Promise.all([listAgents(), listJobRoles()]);
    const jobRole = jobRoles.find((job) => job.name === candidate.target_role) ?? jobRoles[0];
    if (!jobRole) return NextResponse.json({ error: "job_role_not_configured", message: "岗位配置不存在。" }, { status: 400 });

    let current = await getActiveStage(params.id);
    if (!current) {
      const first = await getNextStage(params.id);
      if (!first) return NextResponse.json({ error: "stage_transition_unavailable", message: "没有可启动的关卡。" }, { status: 400 });
      current = first;
    }

    let abilityPlan = candidate.ability_plan;
    if (!abilityPlan) {
      await addEvent({
        candidate_id: params.id,
        stage_id: current.id,
        event_type: "ability_plan_generation_started",
        raw_content: "Calling model to generate ability plan before stage opening.",
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

    const targetStage = await resolveTargetStage(params.id, current);
    const startedStage = await activateTargetStage(params.id, current, targetStage);
    const existingQuestion = await findExistingQuestion(params.id, startedStage.id);
    if (existingQuestion) {
      const progress = await getProgress(params.id);
      return NextResponse.json({ stage: startedStage, message: existingQuestion, existing: true, progress });
    }

    const message = await generateAndPersistOpening({
      candidateId: params.id,
      candidate: { ...candidate, ability_plan: abilityPlan },
      stage: startedStage,
      agents,
      jobRole,
      selectedModel: candidate.selected_model ?? "deepseek"
    });

    const progress = await getProgress(params.id);
    return NextResponse.json({ stage: startedStage, message, existing: false, progress });
  } catch (error) {
    return jsonError(error, "stage_advance_failed");
  }
}

async function resolveTargetStage(candidateId: string, current: Stage) {
  const currentName = normalizeStageName(String(current.name));
  if (currentName === PREP_STAGE) {
    const basic = await getStageByName(candidateId, BASIC_STAGE);
    if (!basic) throw new Error("基础关卡未初始化。");
    return basic;
  }
  if (currentName === BASIC_STAGE) {
    const progress = await getProgress(candidateId);
    if (!progress.canAdvanceStage) {
      throw new Error(`基础关卡尚未完成。当前已完成 ${progress.answeredTurns}/${progress.requiredTurns} 轮，请继续正式作答。`);
    }
    await updateStage(current.id, { status: "completed", completed_at: new Date().toISOString() });
    const ability = await getStageByName(candidateId, ABILITY_STAGE);
    if (!ability) throw new Error("能力关卡未初始化。");
    return ability;
  }
  throw new Error("能力关卡完成后请进入最终提交页，不能继续生成下一关。");
}

async function activateTargetStage(candidateId: string, current: Stage, target: Stage) {
  if (current.id !== target.id && current.status === "in_progress") {
    await updateStage(current.id, { status: "completed", completed_at: new Date().toISOString() });
  }
  await completeOtherActiveStages(candidateId, target.id);
  if (target.status !== "in_progress") {
    return updateStage(target.id, {
      status: "in_progress",
      target_duration_seconds: target.target_duration_seconds ?? stageDurations[normalizeStageName(String(target.name))],
      started_at: new Date().toISOString()
    });
  }
  return target;
}

async function findExistingQuestion(candidateId: string, stageId: string) {
  const messages = await listMessages(candidateId);
  return messages.find((message) => message.stage_id === stageId && message.role === "ai") ?? null;
}

async function generateAndPersistOpening(input: {
  candidateId: string;
  candidate: Candidate;
  stage: Stage;
  agents: Awaited<ReturnType<typeof listAgents>>;
  jobRole: Awaited<ReturnType<typeof listJobRoles>>[number];
  selectedModel: "deepseek" | "openai";
}) {
  const normalizedStage = { ...input.stage, name: normalizeStageName(String(input.stage.name)) };
  await addEvent({
    candidate_id: input.candidateId,
    stage_id: input.stage.id,
    event_type: "question_generation_started",
    raw_content: `Generating opening question for ${normalizedStage.name}`,
    ai_summary: "正在调用模型生成本关首题。"
  });
  const opening = await generateStageOpening({
    provider: input.selectedModel,
    candidate: input.candidate,
    stage: normalizedStage,
    targetRole: input.candidate.target_role ?? input.jobRole.name,
    targetDifficulty: input.candidate.target_difficulty ?? input.jobRole.difficulty,
    abilityDimensions: input.jobRole.ability_dimensions,
    agents: input.agents
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
    event_type: "question_generation_success",
    raw_content: message.content,
    ai_summary: JSON.stringify(opening),
    risk_tags: normalizedStage.name === ABILITY_STAGE ? ["时间限制", "工程资源限制", "证据留痕限制"] : []
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
  if (!normalized.some((stage) => stage.normalizedName === BASIC_STAGE)) {
    await createStage({ candidate_id: candidateId, name: BASIC_STAGE, status: "not_started", target_duration_seconds: stageDurations[BASIC_STAGE] });
  }
  if (!normalized.some((stage) => stage.normalizedName === ABILITY_STAGE)) {
    await createStage({ candidate_id: candidateId, name: ABILITY_STAGE, status: "not_started", target_duration_seconds: stageDurations[ABILITY_STAGE] });
  }
  if (!normalized.some((stage) => stage.normalizedName === PREP_STAGE) && !stages.some((stage) => stage.status === "in_progress")) {
    await createStage({ candidate_id: candidateId, name: PREP_STAGE, status: "in_progress", target_duration_seconds: 0, started_at: new Date().toISOString() });
  }
}

async function createDefaultStages(candidateId: string) {
  await resetStages(candidateId);
  await createStage({ candidate_id: candidateId, name: PREP_STAGE, status: "in_progress", target_duration_seconds: 0, started_at: new Date().toISOString() });
  await createStage({ candidate_id: candidateId, name: BASIC_STAGE, status: "not_started", target_duration_seconds: stageDurations[BASIC_STAGE] });
  await createStage({ candidate_id: candidateId, name: ABILITY_STAGE, status: "not_started", target_duration_seconds: stageDurations[ABILITY_STAGE] });
}

async function getStageByName(candidateId: string, name: StageName) {
  const stages = await listStages(candidateId);
  return stages.find((stage) => normalizeStageName(String(stage.name)) === name && stage.status !== "completed") ?? null;
}

async function getProgress(candidateId: string) {
  const [stages, messages, turnScores] = await Promise.all([
    listStages(candidateId),
    listMessages(candidateId),
    listTurnScores(candidateId)
  ]);
  return buildArenaProgress({ stages, messages, turnScores });
}
