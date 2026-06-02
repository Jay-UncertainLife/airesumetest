import { NextResponse } from "next/server";
import { generateAbilityPlanWithOpenAI } from "@/lib/ai";
import { stageCopy, stageDurations } from "@/lib/stages";
import { addEvent, addMessage, addStage, now, readStore, writeStore } from "@/lib/store";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const store = await readStore();
  const candidate = store.candidates.find((item) => item.id === params.id);
  if (!candidate) return NextResponse.json({ error: "candidate not found" }, { status: 404 });
  const jobRole = store.jobRoles.find((job) => job.enabled && job.name === "AI 产品经理") ?? store.jobRoles[0];
  candidate.target_role = jobRole.name;
  candidate.target_difficulty = jobRole.difficulty;
  candidate.status = "in_progress";
  const roleAgents = store.agents.filter((agent) => agent.target_role === "AI 产品负责人" && agent.status === "enabled");
  const generatedPlan = await generateAbilityPlanWithOpenAI({
    targetRole: jobRole.name,
    agents: roleAgents.length ? roleAgents : store.agents,
    personaProfile: candidate.persona_profile
  });
  candidate.ability_plan = {
    ...generatedPlan,
    role: jobRole.name,
    dimensions: jobRole.ability_dimensions,
    agent_participation: jobRole.basic_participation.map((item) => ({
      agent_role: "custom",
      agent_name: item.ai_role,
      participation_level: item.level,
      weight: item.level === "P3" ? 30 : item.level === "P2" ? 20 : item.level === "P1" ? 10 : 0,
      responsibility: item.reason,
      reason: item.reason
    }))
  };

  store.stages = store.stages.filter((item) => item.candidate_id !== candidate.id);
  store.turnScores = store.turnScores.filter((item) => item.candidate_id !== candidate.id);
  const prepStage = addStage(store, {
    candidate_id: candidate.id,
    name: "面试关卡准备",
    status: "in_progress",
    target_duration_seconds: stageDurations["面试关卡准备"],
    started_at: now()
  });
  addStage(store, {
    candidate_id: candidate.id,
    name: "基础关卡",
    status: "not_started",
    target_duration_seconds: stageDurations["基础关卡"]
  });
  addStage(store, {
    candidate_id: candidate.id,
    name: "能力关卡",
    status: "not_started",
    target_duration_seconds: stageDurations["能力关卡"]
  });
  addEvent(store, {
    candidate_id: candidate.id,
    event_type: "role_selected",
    raw_content: `候选人确认投递：${jobRole.name}（${jobRole.difficulty}）`
  });
  addEvent(store, {
    candidate_id: candidate.id,
    event_type: "ability_plan_generated",
    raw_content: JSON.stringify(candidate.ability_plan),
    ai_summary: `生成 ${candidate.ability_plan.dimensions.length} 个能力维度和 ${candidate.ability_plan.agent_participation.length} 个 Agent 参与度组合`
  });
  addEvent(store, {
    candidate_id: candidate.id,
    stage_id: prepStage.id,
    event_type: "stage_started",
    raw_content: "进入面试关卡准备"
  });
  const message = addMessage(store, {
    candidate_id: candidate.id,
    stage_id: prepStage.id,
    role: "ai",
    ai_role: "examiner",
    model_provider: candidate.selected_model ?? "deepseek",
    agent_id: roleAgents.find((agent) => agent.agent_role === "lead_examiner")?.id,
    content: stageCopy["面试关卡准备"].task
  });
  addEvent(store, {
    candidate_id: candidate.id,
    stage_id: prepStage.id,
    event_type: "ai_question",
    raw_content: message.content,
    ai_summary: "AI 考核官发起面试关卡准备"
  });
  await writeStore(store);
  return NextResponse.json({ candidate, stage: prepStage, message });
}
