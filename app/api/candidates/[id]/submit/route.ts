import { NextResponse } from "next/server";
import { generateFinalEvaluation } from "@/lib/ai";
import { buildArenaProgress } from "@/lib/arenaProgress";
import { assertCandidateToken, jsonError, readJson, tokenFromRequest } from "@/lib/apiUtils";
import { updateCandidate } from "@/lib/repositories/candidates";
import { addEvent, listEvents } from "@/lib/repositories/events";
import { addFinalEvaluation, listTurnScores } from "@/lib/repositories/evaluations";
import { addMessage, listMessages, listWorkspaceMessages } from "@/lib/repositories/messages";
import { listStages, updateStage } from "@/lib/repositories/stages";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ final_solution: string; ai_usage_note: string; candidate_token?: string; confirm?: boolean }>(request);
    const candidate = await assertCandidateToken(params.id, tokenFromRequest(request, body));
    if (candidate.status === "submitted" || candidate.status === "evaluated") {
      return NextResponse.json({ error: "already_submitted", message: "候选人已提交，不能重复提交。" }, { status: 409 });
    }
    if (!body.confirm) {
      return NextResponse.json({ error: "confirmation_required", message: "最终提交需要二次确认。" }, { status: 400 });
    }

    const [stages, currentMessages, currentScores] = await Promise.all([
      listStages(params.id),
      listMessages(params.id),
      listTurnScores(params.id)
    ]);
    const progress = buildArenaProgress({ stages, messages: currentMessages, turnScores: currentScores });
    if (!progress.canSubmitFinal || !progress.currentStage) {
      return NextResponse.json({
        error: "final_submit_not_ready",
        message: `能力关卡尚未完成。当前已完成 ${progress.answeredTurns}/${progress.requiredTurns} 轮。`
      }, { status: 400 });
    }

    await updateStage(progress.currentStage.id, { status: "completed", completed_at: new Date().toISOString() });
    await updateCandidate(candidate.id, {
      final_solution: body.final_solution,
      ai_usage_note: body.ai_usage_note,
      status: "submitted"
    });
    await addEvent({
      candidate_id: params.id,
      stage_id: progress.currentStage.id,
      event_type: "final_submission",
      raw_content: body.final_solution,
      ai_summary: "候选人提交最终方案和 AI 使用说明。"
    });

    const [messages, workspaceMessages, eventLogs, turnScores] = await Promise.all([
      listMessages(params.id),
      listWorkspaceMessages(params.id),
      listEvents(params.id),
      listTurnScores(params.id)
    ]);
    const provider = candidate.selected_model ?? "deepseek";
    const evaluationDraft = await generateFinalEvaluation({
      provider,
      candidateInfo: candidate,
      interviewerEvaluations: candidate.interviewer_evaluations ?? [],
      messages,
      eventLogs,
      workspaceMessages,
      turnScores,
      finalSolution: body.final_solution,
      aiUsageNote: body.ai_usage_note
    });
    const evaluation = await addFinalEvaluation({ ...evaluationDraft, candidate_id: params.id });
    await updateCandidate(candidate.id, { status: "evaluated", final_recommendation: evaluation.recommendation });
    await addMessage({
      candidate_id: params.id,
      stage_id: progress.currentStage.id,
      role: "ai",
      ai_role: "judge",
      model_provider: provider,
      content: `AI 评委建议：${evaluation.recommendation}。${evaluation.reason_summary}`
    });
    await addEvent({
      candidate_id: params.id,
      stage_id: progress.currentStage.id,
      event_type: "ai_evaluation_generated",
      raw_content: JSON.stringify(evaluation),
      ai_summary: `AI 评委生成 ${evaluation.average_score} 分评估，建议：${evaluation.recommendation}`,
      risk_tags: evaluation.risk_tags
    });
    return NextResponse.json({ evaluation });
  } catch (error) {
    return jsonError(error, "candidate_submit_failed");
  }
}
