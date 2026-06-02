import { NextResponse } from "next/server";
import { generateStageOpeningWithDeepSeek } from "@/lib/ai";
import { stageCopy, stageDurations } from "@/lib/stages";
import { addEvent, addMessage, now, readStore, writeStore } from "@/lib/store";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const store = await readStore();
  const candidate = store.candidates.find((item) => item.id === params.id);
  const current = store.stages.find((item) => item.candidate_id === params.id && item.status === "in_progress");
  const next = store.stages.find((item) => item.candidate_id === params.id && item.status === "not_started");
  if (!current || !next) return NextResponse.json({ error: "stage transition unavailable" }, { status: 400 });
  const pressureAgent =
    store.agents.find((agent) => agent.agent_role === "pressure_judge" && agent.status === "enabled") ??
    store.agents.find((agent) => agent.status === "enabled");
  current.status = "completed";
  current.completed_at = now();
  next.status = "in_progress";
  next.target_duration_seconds = next.target_duration_seconds ?? stageDurations[next.name];
  next.started_at = now();
  if (candidate && next.name === "能力关卡") {
    const jobRole = store.jobRoles.find((job) => job.name === candidate.target_role) ?? store.jobRoles[0];
    if (candidate.ability_plan && jobRole) {
      candidate.ability_plan.agent_participation = jobRole.ability_participation.map((item) => ({
        agent_role: "custom",
        agent_name: item.ai_role,
        participation_level: item.level,
        weight: item.level === "P3" ? 30 : item.level === "P2" ? 20 : item.level === "P1" ? 10 : 0,
        responsibility: item.reason,
        reason: item.reason
      }));
    }
  }
  addEvent(store, {
    candidate_id: params.id,
    stage_id: next.id,
    event_type: "stage_started",
    raw_content: `进入${next.name}`
  });
  const openingQuestion = candidate
    ? await generateStageOpeningWithDeepSeek({
        candidate,
        stage: next,
        jobRoleName: candidate.target_role ?? "AI 产品经理",
        difficulty: candidate.target_difficulty ?? "L2",
        abilityPlan: candidate.ability_plan
      })
    : stageCopy[next.name].task;
  const message = addMessage(store, {
    candidate_id: params.id,
    stage_id: next.id,
    role: "ai",
    ai_role: "examiner",
    model_provider: candidate?.selected_model ?? "deepseek",
    agent_id: pressureAgent?.id,
    content: openingQuestion
  });
  addEvent(store, {
    candidate_id: params.id,
    stage_id: next.id,
    event_type: next.name === "能力关卡" ? "pressure_added" : "ai_question",
    raw_content: message.content,
    ai_summary: next.name === "能力关卡" ? "AI 考核官进入能力关卡并施加约束" : "AI 考核官基于候选人画像和岗位配置生成基础关卡题",
    risk_tags: next.name === "能力关卡" ? ["时间限制", "人力限制", "技术限制"] : undefined
  });
  await writeStore(store);
  return NextResponse.json({ stage: next, message });
}
