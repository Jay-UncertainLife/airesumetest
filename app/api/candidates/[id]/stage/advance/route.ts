import { NextResponse } from "next/server";
import { generateAbilityPlan, generateStageOpening } from "@/lib/ai";
import { assertCandidateToken, jsonError, readJson, tokenFromRequest } from "@/lib/apiUtils";
import { listAgents } from "@/lib/repositories/agents";
import { addEvent } from "@/lib/repositories/events";
import { listJobRoles } from "@/lib/repositories/jobRoles";
import { addMessage, listMessages } from "@/lib/repositories/messages";
import { createStage, getActiveStage, getNextStage, listStages, resetStages, updateStage } from "@/lib/repositories/stages";
import { updateCandidate } from "@/lib/repositories/candidates";
import { stageDurations } from "@/lib/stages";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ candidate_token?: string }>(request);
    const candidate = await assertCandidateToken(params.id, tokenFromRequest(request, body));
    await ensureStageFlow(params.id);
    let current = await getActiveStage(params.id);
    let next = await getNextStage(params.id);

    if (!current) {
      const stages = await listStages(params.id);
      const firstNotStarted = stages.find((stage) => stage.status === "not_started");
      if (firstNotStarted) {
        current = await updateStage(firstNotStarted.id, {
          status: "in_progress",
          target_duration_seconds: firstNotStarted.target_duration_seconds ?? stageDurations[firstNotStarted.name],
          started_at: new Date().toISOString()
        });
        next = await getNextStage(params.id);
      }
    }

    if (!current) return NextResponse.json({ error: "stage_transition_unavailable", message: "没有可启动的关卡，请重新打开候选人专属链接。" }, { status: 400 });

    const [agents, jobRoles] = await Promise.all([listAgents(), listJobRoles()]);
    const jobRole = jobRoles.find((job) => job.name === candidate.target_role) ?? jobRoles[0];
    if (!jobRole) return NextResponse.json({ error: "job_role_not_configured" }, { status: 400 });

    let abilityPlan = candidate.ability_plan;
    if (!abilityPlan) {
      abilityPlan = await generateAbilityPlan({
        provider: "deepseek",
        targetRole: candidate.target_role ?? jobRole.name,
        targetDifficulty: candidate.target_difficulty ?? jobRole.difficulty,
        personaProfile: candidate.persona_profile,
        agents,
        fallbackDimensions: jobRole.ability_dimensions
      });
      await updateCandidate(candidate.id, { ability_plan: abilityPlan });
    }

    const currentMessages = await listMessages(params.id);
    const currentHasQuestion = currentMessages.some((message) => message.stage_id === current.id && message.role === "ai");
    if (current.name !== "面试关卡准备" && !currentHasQuestion) {
      const opening = await generateStageOpening({
        provider: candidate.selected_model ?? "deepseek",
        candidate: { ...candidate, ability_plan: abilityPlan },
        stage: current,
        targetRole: candidate.target_role ?? jobRole.name,
        targetDifficulty: candidate.target_difficulty ?? jobRole.difficulty,
        abilityDimensions: jobRole.ability_dimensions
      });
      const agent = agents.find((item) => item.status === "enabled" && item.agent_role === "lead_examiner") ?? agents[0];
      const message = await addMessage({
        candidate_id: params.id,
        stage_id: current.id,
        role: "ai",
        ai_role: "examiner",
        model_provider: candidate.selected_model ?? "deepseek",
        agent_id: agent?.id,
        content: opening.question
      });
      await addEvent({
        candidate_id: params.id,
        stage_id: current.id,
        event_type: current.name === "能力关卡" ? "pressure_added" : "ai_question",
        raw_content: message.content,
        ai_summary: JSON.stringify(opening),
        risk_tags: current.name === "能力关卡" ? ["时间限制", "工程资源限制", "证据留痕限制"] : []
      });
      return NextResponse.json({ stage: current, message, repaired: true });
    }

    if (!next) return NextResponse.json({ error: "stage_transition_unavailable", message: "已经没有下一关，请提交最终方案。" }, { status: 400 });

    await updateStage(current.id, { status: "completed", completed_at: new Date().toISOString() });
    const startedStage = await updateStage(next.id, {
      status: "in_progress",
      target_duration_seconds: next.target_duration_seconds ?? stageDurations[next.name],
      started_at: new Date().toISOString()
    });

    const opening = await generateStageOpening({
      provider: candidate.selected_model ?? "deepseek",
      candidate: { ...candidate, ability_plan: abilityPlan },
      stage: startedStage,
      targetRole: candidate.target_role ?? jobRole.name,
      targetDifficulty: candidate.target_difficulty ?? jobRole.difficulty,
      abilityDimensions: jobRole.ability_dimensions
    });

    const agent = agents.find((item) => item.status === "enabled" && item.agent_role === "lead_examiner") ?? agents[0];
    const message = await addMessage({
      candidate_id: params.id,
      stage_id: startedStage.id,
      role: "ai",
      ai_role: "examiner",
      model_provider: candidate.selected_model ?? "deepseek",
      agent_id: agent?.id,
      content: opening.question
    });
    await addEvent({
      candidate_id: params.id,
      stage_id: startedStage.id,
      event_type: startedStage.name === "能力关卡" ? "pressure_added" : "ai_question",
      raw_content: message.content,
      ai_summary: JSON.stringify(opening),
      risk_tags: startedStage.name === "能力关卡" ? ["时间限制", "工程资源限制", "证据留痕限制"] : []
    });
    return NextResponse.json({ stage: startedStage, message });
  } catch (error) {
    return jsonError(error, "stage_advance_failed");
  }
}

async function ensureStageFlow(candidateId: string) {
  const stages = await listStages(candidateId);
  const hasActive = stages.some((stage) => stage.status === "in_progress");
  const hasBasic = stages.some((stage) => String(stage.name) === "基础关卡" || String(stage.name) === "鍩虹鍏冲崱");
  const hasAbility = stages.some((stage) => String(stage.name) === "能力关卡" || String(stage.name) === "鑳藉姏鍏冲崱");

  if (stages.length === 0) {
    await createDefaultStages(candidateId);
    return;
  }

  if (!hasBasic) {
    await createStage({ candidate_id: candidateId, name: "基础关卡", status: "not_started", target_duration_seconds: stageDurations["基础关卡"] });
  }
  if (!hasAbility) {
    await createStage({ candidate_id: candidateId, name: "能力关卡", status: "not_started", target_duration_seconds: stageDurations["能力关卡"] });
  }
  if (!hasActive) {
    const nextStage = await getNextStage(candidateId);
    if (nextStage) {
      await updateStage(nextStage.id, {
        status: "in_progress",
        target_duration_seconds: nextStage.target_duration_seconds ?? stageDurations[nextStage.name],
        started_at: new Date().toISOString()
      });
    }
  }
}

async function createDefaultStages(candidateId: string) {
  await resetStages(candidateId);
  await createStage({ candidate_id: candidateId, name: "面试关卡准备", status: "in_progress", target_duration_seconds: 0, started_at: new Date().toISOString() });
  await createStage({ candidate_id: candidateId, name: "基础关卡", status: "not_started", target_duration_seconds: stageDurations["基础关卡"] });
  await createStage({ candidate_id: candidateId, name: "能力关卡", status: "not_started", target_duration_seconds: stageDurations["能力关卡"] });
}
