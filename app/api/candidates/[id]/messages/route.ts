import { NextResponse } from "next/server";
import { generateEvaluation, generateFollowUp, scoreTurnWithDeepSeek } from "@/lib/ai";
import { calculateTimeCoefficient } from "@/lib/stages";
import { addEvent, addMessage, now, readStore, upsertEvaluation, writeStore } from "@/lib/store";
import { ModelProvider } from "@/lib/types";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const store = await readStore();
  return NextResponse.json({
    messages: store.messages.filter((item) => item.candidate_id === params.id),
    eventLogs: store.eventLogs.filter((item) => item.candidate_id === params.id),
    turnScores: store.turnScores.filter((item) => item.candidate_id === params.id)
  });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { content, model_provider } = await request.json();
  const store = await readStore();
  const candidate = store.candidates.find((item) => item.id === params.id);
  if (!candidate) return NextResponse.json({ error: "candidate not found" }, { status: 404 });
  const selectedModel = ((model_provider ?? candidate.selected_model ?? "deepseek") as ModelProvider);
  candidate.selected_model = selectedModel;
  const currentStage = store.stages.find((item) => item.candidate_id === params.id && item.status === "in_progress");
  if (!currentStage) return NextResponse.json({ error: "active stage not found" }, { status: 404 });
  const elapsedSeconds = currentStage.started_at
    ? Math.max(0, Math.round((Date.now() - new Date(currentStage.started_at).getTime()) / 1000))
    : 0;
  const targetSeconds = currentStage.target_duration_seconds ?? 0;
  const timeCoefficient = calculateTimeCoefficient(elapsedSeconds, targetSeconds);

  const candidateMessage = addMessage(store, {
    candidate_id: params.id,
    stage_id: currentStage.id,
    role: "candidate",
    model_provider: selectedModel,
    content
  });
  addEvent(store, {
    candidate_id: params.id,
    stage_id: currentStage.id,
    event_type: "candidate_response",
    raw_content: content,
    ai_summary: "候选人提交了一次关卡回应"
  });
  for (const decisionEvent of detectDecisionEvents(content)) {
    addEvent(store, {
      candidate_id: params.id,
      stage_id: currentStage.id,
      event_type: decisionEvent.type,
      raw_content: content,
      ai_summary: decisionEvent.summary,
      risk_tags: decisionEvent.tags
    });
  }
  addEvent(store, {
    candidate_id: params.id,
    stage_id: currentStage.id,
    event_type: "model_selected",
    raw_content: `候选人本轮选择模型：${selectedModel}`,
    ai_summary: "模型选择已留痕"
  });

  const agent =
    store.agents.find((item) => item.target_role === candidate.target_role && item.status === "enabled" && item.agent_role === "lead_examiner") ??
    store.agents.find((item) => item.target_role === candidate.target_role && item.status === "enabled") ??
    store.agents.find((item) => item.status === "enabled") ??
    store.agents[0];
  const history = store.messages.filter((item) => item.candidate_id === params.id);
  const abilityPlan = candidate.ability_plan ?? {
    role: "AI 产品负责人",
    generated_by: "mock" as const,
    dimensions: [],
    agent_participation: [],
    question_strategy: []
  };
  const turnScore = await scoreTurnWithDeepSeek({
    candidateAnswer: content,
    currentStage,
    abilityPlan,
    selectedModel,
    messageId: candidateMessage.id,
    candidateId: params.id,
    elapsedSeconds,
    timeCoefficient
  });
  store.turnScores.push(turnScore);
  addEvent(store, {
    candidate_id: params.id,
    stage_id: currentStage.id,
    event_type: "turn_score_generated",
    raw_content: JSON.stringify(turnScore),
    ai_summary: `本轮得分 ${turnScore.average_score}，耗时 ${elapsedSeconds} 秒，时间系数 ${timeCoefficient}，建议：${turnScore.recommendation}`,
    risk_tags: turnScore.risk_tags
  });
  addEvent(store, {
    candidate_id: params.id,
    stage_id: currentStage.id,
    event_type: "stage_time_recorded",
    raw_content: `elapsed=${elapsedSeconds};target=${targetSeconds};coefficient=${timeCoefficient}`,
    ai_summary: `本轮作答耗时 ${formatDuration(elapsedSeconds)}，目标时长 ${formatDuration(targetSeconds)}，时间系数 ${timeCoefficient}`
  });
  if (turnScore.recommendation === "Cut" || turnScore.average_score < 65) {
    candidate.final_recommendation = "Cut";
    addEvent(store, {
      candidate_id: params.id,
      stage_id: currentStage.id,
      event_type: "human_review_required",
      raw_content: JSON.stringify(turnScore),
      ai_summary: `本轮得分 ${turnScore.average_score}，低于阈值，进入人工复核提示`,
      risk_tags: ["低分复核", ...turnScore.risk_tags]
    });
  }

  const stageScores = store.turnScores.filter((item) => item.candidate_id === params.id && item.stage_id === currentStage.id);
  const passedStageScores = stageScores.filter((item) => item.recommendation === "通过" && item.average_score >= 80);
  if (currentStage.name === "能力关卡" && passedStageScores.length >= 3) {
    currentStage.status = "completed";
    currentStage.completed_at = now();
    candidate.final_solution = buildAutoFinalSolution(store.messages.filter((item) => item.candidate_id === params.id));
    candidate.ai_usage_note = buildAutoAiUsageNote(store.workspaceMessages?.filter((item) => item.candidate_id === params.id) ?? []);
    candidate.status = "submitted";
    addEvent(store, {
      candidate_id: params.id,
      stage_id: currentStage.id,
      event_type: "auto_final_submission",
      raw_content: candidate.final_solution,
      ai_summary: "能力关卡连续 3 轮通过，系统自动汇总正式回答并提交最终方案"
    });
    const agent = store.agents.find((item) => item.status === "enabled") ?? store.agents[0];
    const evaluation = generateEvaluation({
      candidateInfo: candidate,
      messages: store.messages.filter((item) => item.candidate_id === params.id),
      eventLogs: store.eventLogs.filter((item) => item.candidate_id === params.id),
      finalSolution: candidate.final_solution,
      aiUsageNote: candidate.ai_usage_note,
      agentConfig: agent,
      turnScores: store.turnScores.filter((item) => item.candidate_id === params.id)
    });
    upsertEvaluation(store, evaluation);
    candidate.status = "evaluated";
    candidate.final_recommendation = evaluation.recommendation;
    addMessage(store, {
      candidate_id: params.id,
      stage_id: currentStage.id,
      role: "ai",
      ai_role: "judge",
      model_provider: "deepseek",
      content: `连续 3 轮通过，系统已自动生成最终报告。AI 评委建议：${evaluation.recommendation}。${evaluation.reason_summary}`
    });
    addEvent(store, {
      candidate_id: params.id,
      stage_id: currentStage.id,
      event_type: "ai_evaluation_generated",
      raw_content: JSON.stringify(evaluation),
      ai_summary: `连续 3 轮通过后自动生成最终报告，建议：${evaluation.recommendation}`,
      risk_tags: evaluation.risk_tags
    });
    await writeStore(store);
    return NextResponse.json({ candidateMessage, turnScore, autoSubmitted: true, evaluation });
  }

  const followUp = await generateFollowUp({
    candidateAnswer: content,
    currentStage,
    agentConfig: agent,
    conversationHistory: history,
    abilityPlan,
    turnScore,
    modelProvider: selectedModel
  });
  const aiMessage = addMessage(store, {
    candidate_id: params.id,
    stage_id: currentStage.id,
    role: "ai",
    ai_role: "examiner",
    model_provider: selectedModel,
    agent_id: agent.id,
    content: followUp.question
  });
  addEvent(store, {
    candidate_id: params.id,
    stage_id: currentStage.id,
    event_type: followUp.event_type,
    raw_content: followUp.question,
    ai_summary: followUp.event_type === "pressure_added" ? "AI 考核官加入限制条件" : "AI 考核官基于上一轮回答继续追问",
    risk_tags: followUp.risk_tags
  });
  if (followUp.risk_tags?.length) {
    addEvent(store, {
      candidate_id: params.id,
      stage_id: currentStage.id,
      event_type: "weak_signal_detected",
      raw_content: followUp.risk_tags.join("、"),
      ai_summary: "系统识别到候选人回答中的薄弱信号",
      risk_tags: followUp.risk_tags
    });
  }
  await writeStore(store);
  return NextResponse.json({ candidateMessage, aiMessage, turnScore });
}

function buildAutoFinalSolution(messages: Array<{ role: string; content: string }>) {
  const answers = messages
    .filter((item) => item.role === "candidate")
    .map((item, index) => `第 ${index + 1} 轮正式回答：\n${item.content}`)
    .join("\n\n");
  return `系统自动汇总最终方案：\n\n${answers || "候选人未形成有效正式回答。"}`;
}

function buildAutoAiUsageNote(messages: Array<{ role: string; model_provider?: string; content: string }>) {
  if (!messages.length) return "候选人未使用模型工作区，最终报告基于正式回答生成。";
  return messages
    .map((item, index) => `${index + 1}. ${item.role === "model" ? "模型回复" : "候选人提问"}（${item.model_provider ?? "unknown"}）：${item.content}`)
    .join("\n");
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}分${secs}秒`;
}

function detectDecisionEvents(content: string) {
  const events: Array<{ type: string; summary: string; tags: string[] }> = [];
  const keyChanges = [
    ["改目标", /改目标|目标调整|重新定位/],
    ["改结构", /改结构|结构调整|重构/],
    ["改角色", /改角色|角色分工|Agent 分工|考核官分工/],
    ["改评分", /改评分|评分标准|打分/],
    ["改红线", /红线|淘汰|Cut|强制复核/],
    ["改实现", /改实现|实现方式|技术方案|API|页面|字段/],
    ["改范围", /改范围|砍掉|不做|收缩|取舍/],
    ["改结论", /改结论|结论调整|最终判断/]
  ] as const;
  keyChanges.forEach(([name, pattern]) => {
    if (pattern.test(content)) events.push({ type: "key_modification_recorded", summary: `记录关键修改：${name}`, tags: [name] });
  });
  if (/砍掉|不做|保留|取舍|时间约束|资源约束|两周|人力/.test(content)) {
    events.push({ type: "tradeoff_recorded", summary: "记录候选人在约束下的取舍变化", tags: ["取舍记录"] });
  }
  if (/拒绝|不同意|反驳|我不采纳|不能这样/.test(content)) {
    events.push({ type: "rebuttal_recorded", summary: "记录候选人对建议或问题的反驳", tags: ["反驳记录"] });
  }
  return events;
}
