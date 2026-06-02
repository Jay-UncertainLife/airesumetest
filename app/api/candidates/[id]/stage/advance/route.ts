import { NextResponse } from "next/server";
import { generateAbilityPlan, generateStageOpening } from "@/lib/ai";
import { assertCandidateToken, jsonError, readJson, tokenFromRequest } from "@/lib/apiUtils";
import { listAgents } from "@/lib/repositories/agents";
import { addEvent } from "@/lib/repositories/events";
import { listJobRoles } from "@/lib/repositories/jobRoles";
import { addMessage } from "@/lib/repositories/messages";
import { getActiveStage, getNextStage, updateStage } from "@/lib/repositories/stages";
import { updateCandidate } from "@/lib/repositories/candidates";
import { stageDurations } from "@/lib/stages";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ candidate_token?: string }>(request);
    const candidate = await assertCandidateToken(params.id, tokenFromRequest(request, body));
    const current = await getActiveStage(params.id);
    const next = await getNextStage(params.id);
    if (!current || !next) return NextResponse.json({ error: "stage_transition_unavailable" }, { status: 400 });

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
