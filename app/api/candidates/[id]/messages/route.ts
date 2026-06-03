import { NextResponse } from "next/server";
import { generateFollowUp, scoreTurn } from "@/lib/ai";
import { buildArenaProgress } from "@/lib/arenaProgress";
import { assertCandidateToken, jsonError, readJson, tokenFromRequest } from "@/lib/apiUtils";
import { calculateTimeCoefficient } from "@/lib/stages";
import { normalizeStageName } from "@/lib/stageNames";
import { listAgents } from "@/lib/repositories/agents";
import { updateCandidate } from "@/lib/repositories/candidates";
import { addEvent, listEvents } from "@/lib/repositories/events";
import { addTurnScore, listTurnScores } from "@/lib/repositories/evaluations";
import { addMessage, listMessages } from "@/lib/repositories/messages";
import { getActiveStage, listStages } from "@/lib/repositories/stages";
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
    const body = await readJson<{ content: string; ai_usage_note?: string; model_provider?: ModelProvider; candidate_token?: string }>(request);
    if (!body.content?.trim()) return NextResponse.json({ error: "empty_answer", message: "正式回答不能为空。" }, { status: 400 });

    const candidate = await assertCandidateToken(params.id, tokenFromRequest(request, body));
    const selectedModel = body.model_provider === "openai" ? "openai" : candidate.selected_model ?? "deepseek";
    const currentStage = await getActiveStage(params.id);
    if (!currentStage) return NextResponse.json({ error: "active_stage_not_found", message: "当前没有进行中的关卡。" }, { status: 404 });
    if (!candidate.ability_plan) return NextResponse.json({ error: "ability_plan_not_ready", message: "能力维度尚未生成，请先进入关卡准备流程。" }, { status: 400 });

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
      content: body.content.trim()
    });
    await addEvent({
      candidate_id: params.id,
      stage_id: currentStage.id,
      event_type: "answer_submitted",
      raw_content: JSON.stringify({ answer: body.content, ai_usage_note: body.ai_usage_note ?? "" }),
      ai_summary: "候选人提交了一次正式关卡回答。"
    });

    const turnScoreDraft = await scoreTurn({
      provider: selectedModel,
      candidateAnswer: body.content,
      aiUsageNote: body.ai_usage_note,
      currentStage: { ...currentStage, name: normalizeStageName(String(currentStage.name)) },
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
      event_type: "scoring_success",
      raw_content: JSON.stringify(turnScore),
      ai_summary: `本轮得分 ${turnScore.average_score}，建议：${turnScore.recommendation}`,
      risk_tags: turnScore.risk_tags
    });

    if (turnScore.recommendation === "Cut" || turnScore.average_score < 65) {
      await updateCandidate(candidate.id, { final_recommendation: "Cut" });
      await addEvent({
        candidate_id: params.id,
        stage_id: currentStage.id,
        event_type: "manual_review_required",
        raw_content: JSON.stringify(turnScore),
        ai_summary: `本轮得分 ${turnScore.average_score}，低于阈值，审核官页面需人工复核。`,
        risk_tags: ["低分复核", ...turnScore.risk_tags]
      });
    }

    const scoresAfter = await listTurnScores(params.id);
    let progress = buildArenaProgress({
      stages: await listStages(params.id),
      messages: await listMessages(params.id),
      turnScores: scoresAfter
    });

    if (progress.stageComplete) {
      await addEvent({
        candidate_id: params.id,
        stage_id: currentStage.id,
        event_type: "stage_rounds_completed",
        raw_content: JSON.stringify(progress),
        ai_summary: `${normalizeStageName(String(currentStage.name))} 已完成 ${progress.answeredTurns}/${progress.requiredTurns} 轮，可进入下一步。`
      });
      return NextResponse.json({ candidateMessage, aiMessage: null, turnScore, progress });
    }

    const agents = await listAgents();
    const agent =
      agents.find((item) => item.status === "enabled" && item.target_role === candidate.target_role && item.agent_role === "lead_examiner") ??
      agents.find((item) => item.status === "enabled") ??
      agents[0];
    if (!agent) return NextResponse.json({ error: "agent_not_configured", message: "尚未配置可用 AI Agent。" }, { status: 400 });

    const history = await listMessages(params.id);
    const followUp = await generateFollowUp({
      provider: selectedModel,
      candidateAnswer: body.content,
      currentStage: { ...currentStage, name: normalizeStageName(String(currentStage.name)) },
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
      agent_id: agent.id,
      content: followUp.question
    });
    await addEvent({
      candidate_id: params.id,
      stage_id: currentStage.id,
      event_type: followUp.event_type,
      raw_content: followUp.question,
      ai_summary: "AI 考核官基于上一轮回答继续追问。",
      risk_tags: followUp.risk_tags
    });
    progress = buildArenaProgress({
      stages: await listStages(params.id),
      messages: await listMessages(params.id),
      turnScores: await listTurnScores(params.id)
    });
    return NextResponse.json({ candidateMessage, aiMessage, turnScore, progress });
  } catch (error) {
    return jsonError(error, "candidate_message_failed");
  }
}
