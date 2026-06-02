import { NextResponse } from "next/server";
import { generateEvaluation } from "@/lib/ai";
import { addEvent, addMessage, now, readStore, upsertEvaluation, writeStore } from "@/lib/store";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { final_solution, ai_usage_note } = await request.json();
  const store = await readStore();
  const candidate = store.candidates.find((item) => item.id === params.id);
  if (!candidate) return NextResponse.json({ error: "candidate not found" }, { status: 404 });
  candidate.final_solution = final_solution;
  candidate.ai_usage_note = ai_usage_note;
  candidate.status = "submitted";
  const currentStage = store.stages.find((item) => item.candidate_id === params.id && item.status === "in_progress");
  if (currentStage) {
    currentStage.status = "completed";
    currentStage.completed_at = now();
  }
  addEvent(store, {
    candidate_id: params.id,
    stage_id: currentStage?.id,
    event_type: "final_submission",
    raw_content: final_solution,
    ai_summary: "候选人提交最终方案和 AI 使用说明"
  });
  const agent = store.agents.find((item) => item.status === "enabled") ?? store.agents[0];
  const turnScores = store.turnScores.filter((item) => item.candidate_id === params.id);
  const evaluation = generateEvaluation({
    candidateInfo: candidate,
    messages: store.messages.filter((item) => item.candidate_id === params.id),
    eventLogs: store.eventLogs.filter((item) => item.candidate_id === params.id),
    finalSolution: final_solution,
    aiUsageNote: ai_usage_note,
    agentConfig: agent,
    turnScores
  });
  upsertEvaluation(store, evaluation);
  candidate.status = "evaluated";
  candidate.final_recommendation = evaluation.recommendation;
  addMessage(store, {
    candidate_id: params.id,
    stage_id: currentStage?.id ?? "final",
    role: "ai",
    ai_role: "judge",
    model_provider: candidate.selected_model ?? "deepseek",
    content: `AI 评委建议：${evaluation.recommendation}。${evaluation.reason_summary}`
  });
  addEvent(store, {
    candidate_id: params.id,
    stage_id: currentStage?.id,
    event_type: "ai_evaluation_generated",
    raw_content: JSON.stringify(evaluation),
    ai_summary: `AI 评委生成 ${evaluation.average_score} 分评估，建议：${evaluation.recommendation}`,
    risk_tags: evaluation.risk_tags
  });
  await writeStore(store);
  return NextResponse.json({ evaluation });
}
