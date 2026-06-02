import { NextResponse } from "next/server";
import { generateFinalEvaluation, generateFollowUp, scoreTurn } from "@/lib/ai";
import { assertCandidateToken, jsonError, readJson, tokenFromRequest } from "@/lib/apiUtils";
import { calculateTimeCoefficient } from "@/lib/stages";
import { listAgents } from "@/lib/repositories/agents";
import { updateCandidate } from "@/lib/repositories/candidates";
import { addEvent, listEvents } from "@/lib/repositories/events";
import { addFinalEvaluation, addTurnScore, listTurnScores } from "@/lib/repositories/evaluations";
import { addMessage, listMessages, listWorkspaceMessages } from "@/lib/repositories/messages";
import { getActiveStage, updateStage } from "@/lib/repositories/stages";
import { ModelProvider } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await assertCandidateToken(params.id, tokenFromRequest(request));
    const [messages, eventLogs, turnScores] = await Promise.all([
      listMessages(params.id),
      listEvents(params.id),
      listTurnScores(params.id)
    ]);
    return NextResponse.json({ messages, eventLogs, turnScores });
  } catch (error) {
    return jsonError(error, "candidate_messages_failed");
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ content: string; model_provider?: ModelProvider; candidate_token?: string }>(request);
    const candidate = await assertCandidateToken(params.id, tokenFromRequest(request, body));
    const selectedModel = body.model_provider === "openai" ? "openai" : candidate.selected_model ?? "deepseek";
    const currentStage = await getActiveStage(params.id);
    if (!currentStage) return NextResponse.json({ error: "active_stage_not_found" }, { status: 404 });
    if (!candidate.ability_plan) return NextResponse.json({ error: "ability_plan_not_ready" }, { status: 400 });

    const elapsedSeconds = currentStage.started_at
      ? Math.max(0, Math.round((Date.now() - new Date(currentStage.started_at).getTime()) / 1000))
      : 0;
    const targetSeconds = currentStage.target_duration_seconds ?? 0;
    const timeCoefficient = calculateTimeCoefficient(elapsedSeconds, targetSeconds);
    await updateCandidate(candidate.id, { selected_model: selectedModel });

    const candidateMessage = await addMessage({
      candidate_id: params.id,
      stage_id: currentStage.id,
      role: "candidate",
      model_provider: selectedModel,
      content: body.content
    });
    await addEvent({
      candidate_id: params.id,
      stage_id: currentStage.id,
      event_type: "candidate_response",
      raw_content: body.content,
      ai_summary: "候选人提交了一次关卡回应"
    });

    const turnScoreDraft = await scoreTurn({
      provider: selectedModel,
      candidateAnswer: body.content,
      currentStage,
      abilityPlan: candidate.ability_plan,
      messageId: candidateMessage.id,
      candidateId: params.id,
      elapsedSeconds,
      timeCoefficient
    });
    const turnScore = await addTurnScore(turnScoreDraft);
    await addEvent({
      candidate_id: params.id,
      stage_id: currentStage.id,
      event_type: "turn_score_generated",
      raw_content: JSON.stringify(turnScore),
      ai_summary: `本轮得分 ${turnScore.average_score}，建议：${turnScore.recommendation}`,
      risk_tags: turnScore.risk_tags
    });
    await addEvent({
      candidate_id: params.id,
      stage_id: currentStage.id,
      event_type: "stage_time_recorded",
      raw_content: `elapsed=${elapsedSeconds};target=${targetSeconds};coefficient=${timeCoefficient}`,
      ai_summary: `本轮作答耗时 ${elapsedSeconds} 秒，时间系数 ${timeCoefficient}`
    });

    if (turnScore.recommendation === "Cut" || turnScore.average_score < 65) {
      await updateCandidate(candidate.id, { final_recommendation: "Cut" });
      await addEvent({
        candidate_id: params.id,
        stage_id: currentStage.id,
        event_type: "human_review_required",
        raw_content: JSON.stringify(turnScore),
        ai_summary: `本轮得分 ${turnScore.average_score}，低于阈值，进入人工复核提示`,
        risk_tags: ["低分复核", ...turnScore.risk_tags]
      });
    }

    const allScores = await listTurnScores(params.id);
    const currentStagePasses = allScores.filter((item) => item.stage_id === currentStage.id && item.recommendation === "通过" && item.average_score >= 80);
    if (currentStage.name === "能力关卡" && currentStagePasses.length >= 3) {
      await updateStage(currentStage.id, { status: "completed", completed_at: new Date().toISOString() });
      const messages = await listMessages(params.id);
      const workspaceMessages = await listWorkspaceMessages(params.id);
      const eventLogs = await listEvents(params.id);
      const finalSolution = buildAutoFinalSolution(messages);
      const aiUsageNote = buildAutoAiUsageNote(workspaceMessages);
      const evaluationDraft = await generateFinalEvaluation({
        provider: selectedModel,
        candidateInfo: { ...candidate, final_solution: finalSolution, ai_usage_note: aiUsageNote },
        interviewerEvaluations: candidate.interviewer_evaluations ?? [],
        messages,
        eventLogs,
        workspaceMessages,
        turnScores: allScores,
        finalSolution,
        aiUsageNote
      });
      const evaluation = await addFinalEvaluation({ ...evaluationDraft, candidate_id: params.id });
      await updateCandidate(candidate.id, {
        status: "evaluated",
        final_solution: finalSolution,
        ai_usage_note: aiUsageNote,
        final_recommendation: evaluation.recommendation
      });
      await addMessage({
        candidate_id: params.id,
        stage_id: currentStage.id,
        role: "ai",
        ai_role: "judge",
        model_provider: selectedModel,
        content: `连续 3 轮通过，系统已自动生成最终报告。AI 评委建议：${evaluation.recommendation}。${evaluation.reason_summary}`
      });
      return NextResponse.json({ candidateMessage, turnScore, autoSubmitted: true, evaluation });
    }

    const agents = await listAgents();
    const agent = agents.find((item) => item.status === "enabled" && item.target_role === candidate.target_role && item.agent_role === "lead_examiner") ??
      agents.find((item) => item.status === "enabled") ??
      agents[0];
    const history = await listMessages(params.id);
    const followUp = await generateFollowUp({
      provider: selectedModel,
      candidateAnswer: body.content,
      currentStage,
      agentConfig: agent,
      conversationHistory: history,
      abilityPlan: candidate.ability_plan,
      turnScore
    });
    const aiMessage = await addMessage({
      candidate_id: params.id,
      stage_id: currentStage.id,
      role: "ai",
      ai_role: "examiner",
      model_provider: selectedModel,
      agent_id: agent?.id,
      content: followUp.question
    });
    await addEvent({
      candidate_id: params.id,
      stage_id: currentStage.id,
      event_type: followUp.event_type,
      raw_content: followUp.question,
      ai_summary: "AI 考核官基于上一轮回答继续追问",
      risk_tags: followUp.risk_tags
    });
    return NextResponse.json({ candidateMessage, aiMessage, turnScore });
  } catch (error) {
    return jsonError(error, "candidate_message_failed");
  }
}

function buildAutoFinalSolution(messages: Array<{ role: string; content: string }>) {
  return messages
    .filter((item) => item.role === "candidate")
    .map((item, index) => `第 ${index + 1} 轮正式回答：\n${item.content}`)
    .join("\n\n");
}

function buildAutoAiUsageNote(messages: Array<{ role: string; model_provider?: string; content: string }>) {
  if (!messages.length) return "候选人未使用模型工作区，最终报告基于正式回答生成。";
  return messages
    .map((item, index) => `${index + 1}. ${item.role === "model" ? "模型回复" : "候选人提问"}（${item.model_provider ?? "unknown"}）：${item.content}`)
    .join("\n");
}
