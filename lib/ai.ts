import { loadPrompt } from "./prompts";
import {
  AbilityDimension,
  AbilityPlan,
  Agent,
  Candidate,
  Evaluation,
  EventLog,
  InterviewerEvaluation,
  Message,
  ModelProvider,
  PersonaProfile,
  Stage,
  TurnScore,
  WorkspaceMessage
} from "./types";
import { callModel, parseJsonObject } from "./modelClients";
import { ABILITY_STAGE, normalizeStageName } from "./stageNames";

export async function analyzePersonaWithDeepSeek(input: {
  candidateName: string;
  targetRole: string;
  targetDifficulty: string;
  resumeText: string;
  interviewerEvaluations: InterviewerEvaluation[];
}) {
  const user = await loadPrompt("persona-profile.deepseek.md", input);
  const result = await callModel({
    provider: "deepseek",
    system: "你是招聘考核场景的人才画像分析官。必须只输出合法 JSON，不要输出 Markdown 或解释性文字。",
    user,
    temperature: 0.1
  });
  return parseJsonObject<PersonaProfile>(result.content);
}

export async function generateAbilityPlan(input: {
  provider: ModelProvider;
  targetRole: string;
  targetDifficulty: string;
  personaProfile?: PersonaProfile;
  agents: Agent[];
  fallbackDimensions: AbilityDimension[];
}): Promise<AbilityPlan> {
  const promptName = input.provider === "openai" ? "ability-plan.openai.md" : "ability-plan.deepseek.md";
  const user = await loadPrompt(promptName, {
    targetRole: input.targetRole,
    targetDifficulty: input.targetDifficulty,
    personaProfile: input.personaProfile ?? {},
    agents: input.agents,
    fallbackDimensions: input.fallbackDimensions
  });
  const result = await callModel({
    provider: input.provider,
    system: "你是 AI 产品经理岗位考核策略官。必须只输出合法 JSON，不要输出 Markdown 或解释性文字。",
    user,
    temperature: 0.2
  });
  const parsed = parseJsonObject<Omit<AbilityPlan, "generated_by">>(result.content);
  return normalizeAbilityPlan({
    ...parsed,
    generated_by: input.provider,
    dimensions: parsed.dimensions?.length ? parsed.dimensions : input.fallbackDimensions
  });
}

export async function generateStageOpening(input: {
  provider: ModelProvider;
  candidate: Candidate;
  stage: Stage;
  targetRole: string;
  targetDifficulty: string;
  abilityDimensions: AbilityDimension[];
  agents?: Agent[];
}) {
  const stageName = normalizeStageName(String(input.stage.name));
  const promptName = stageName === ABILITY_STAGE ? "ability_stage/generate_first_question.md" : "basic_stage/generate_first_question.md";
  const user = await loadPrompt(promptName, {
    personaProfile: input.candidate.persona_profile ?? {},
    resumeText: input.candidate.resume_text ?? "",
    targetRole: input.targetRole,
    targetDifficulty: input.targetDifficulty,
    abilityDimensions: input.abilityDimensions,
    agentParticipation: input.candidate.ability_plan?.agent_participation ?? [],
    questionStrategy: input.candidate.ability_plan?.question_strategy ?? [],
    agents: input.agents ?? []
  });
  const result = await callModel({
    provider: input.provider,
    system: "你是 AI 产品经理岗位的 AI 考核官。必须只输出合法 JSON，不要输出 Markdown 或解释性文字。JSON 必须包含 question 字段。",
    user,
    temperature: 0.25
  });
  const parsed = parseJsonObject<{ question: string; dimension_key?: string; target_dimensions?: string[] }>(result.content);
  if (!parsed.question?.trim()) throw new Error("Stage opening model response missing question.");
  return parsed;
}

export async function generateWorkspaceReply(input: {
  candidate: Candidate;
  stage?: Stage;
  modelProvider: ModelProvider;
  userMessage: string;
}) {
  const promptName = input.modelProvider === "openai" ? "workspace-reply.openai.md" : "workspace-reply.deepseek.md";
  const user = await loadPrompt(promptName, {
    personaProfile: input.candidate.persona_profile ?? {},
    targetRole: input.candidate.target_role ?? "AI 产品经理",
    targetDifficulty: input.candidate.target_difficulty ?? "L2",
    stageName: input.stage ? normalizeStageName(String(input.stage.name)) : "未进入关卡",
    abilityDimensions: input.candidate.ability_plan?.dimensions ?? [],
    candidateQuestion: input.userMessage
  });
  const result = await callModel({
    provider: input.modelProvider,
    system: "你是候选人的 AI 思考助手，不是考核官。你可以帮助拆解思路，但不能直接代写完整正式答案。",
    user,
    temperature: 0.3
  });
  return result.content.trim();
}

export async function scoreTurn(input: {
  provider: ModelProvider;
  candidateAnswer: string;
  aiUsageNote?: string;
  currentStage: Stage;
  abilityPlan: AbilityPlan;
  messageId: string;
  candidateId: string;
  elapsedSeconds: number;
  timeCoefficient: number;
}) {
  const stageName = normalizeStageName(String(input.currentStage.name));
  const promptName = stageName === ABILITY_STAGE ? "ability_stage/score_answer.md" : "basic_stage/score_answer.md";
  const user = await loadPrompt(promptName, {
    stageName,
    abilityDimensions: input.abilityPlan.dimensions,
    candidateAnswer: input.candidateAnswer,
    aiUsageNote: input.aiUsageNote ?? "",
    elapsedSeconds: input.elapsedSeconds,
    timeCoefficient: input.timeCoefficient
  });
  const result = await callModel({
    provider: input.provider,
    system: "你是 AI 产品经理岗位逐题评分器。必须只输出合法 JSON，不要输出 Markdown 或解释性文字。",
    user,
    temperature: 0.1
  });
  const parsed = parseJsonObject<Omit<TurnScore, "id" | "candidate_id" | "message_id" | "stage_id" | "model_provider" | "created_at">>(result.content);
  const normalized = normalizeTurnScore(parsed, input.abilityPlan.dimensions);
  return {
    candidate_id: input.candidateId,
    message_id: input.messageId,
    stage_id: input.currentStage.id,
    elapsed_seconds: input.elapsedSeconds,
    time_coefficient: input.timeCoefficient,
    scores: normalized.scores,
    average_score: normalized.average_score,
    recommendation: normalized.recommendation,
    risk_tags: normalized.risk_tags,
    reason_summary: normalized.reason_summary,
    next_question_standard: normalized.next_question_standard,
    model_provider: input.provider
  };
}

export async function generateFollowUp(input: {
  provider: ModelProvider;
  candidateAnswer: string;
  currentStage: Stage;
  agentConfig: Agent;
  conversationHistory: Message[];
  abilityPlan?: AbilityPlan;
  turnScore?: TurnScore;
}) {
  const stageName = normalizeStageName(String(input.currentStage.name));
  const promptName = stageName === ABILITY_STAGE ? "ability_stage/generate_followup_question.md" : "basic_stage/generate_followup_question.md";
  const user = await loadPrompt(promptName, {
    stageName,
    agentConfig: input.agentConfig,
    abilityDimensions: input.abilityPlan?.dimensions ?? [],
    conversationHistory: input.conversationHistory,
    turnScore: input.turnScore ?? {},
    candidateAnswer: input.candidateAnswer
  });
  const result = await callModel({
    provider: input.provider,
    system: "你是 AI 产品经理岗位考核官。必须只输出合法 JSON，不要输出 Markdown 或解释性文字。JSON 必须包含 question 字段。",
    user,
    temperature: 0.3
  });
  const parsed = parseJsonObject<{
    question: string;
    event_type?: "ai_question" | "pressure_added";
    risk_tags?: string[];
    target_dimensions?: string[];
  }>(result.content);
  if (!parsed.question?.trim()) throw new Error("Follow-up model response missing question.");
  return {
    question: parsed.question,
    event_type: parsed.event_type ?? "ai_question",
    risk_tags: Array.isArray(parsed.risk_tags) ? parsed.risk_tags : [],
    target_dimensions: Array.isArray(parsed.target_dimensions) ? parsed.target_dimensions : []
  };
}

export async function generateFinalEvaluation(input: {
  provider: ModelProvider;
  candidateInfo: Candidate;
  interviewerEvaluations: InterviewerEvaluation[];
  messages: Message[];
  eventLogs: EventLog[];
  workspaceMessages: WorkspaceMessage[];
  turnScores: TurnScore[];
  finalSolution: string;
  aiUsageNote: string;
}): Promise<Omit<Evaluation, "id" | "candidate_id" | "created_at">> {
  const user = await loadPrompt("final_stage/generate_review_report.md", {
    personaProfile: input.candidateInfo.persona_profile ?? {},
    resumeText: input.candidateInfo.resume_text ?? "",
    interviewerEvaluations: input.interviewerEvaluations,
    conversationHistory: input.messages,
    eventLogs: input.eventLogs,
    workspaceMessages: input.workspaceMessages,
    turnScores: input.turnScores,
    finalSolution: input.finalSolution,
    aiUsageNote: input.aiUsageNote,
    abilityDimensions: input.candidateInfo.ability_plan?.dimensions ?? []
  });
  const result = await callModel({
    provider: input.provider,
    system: "你是 AI 产品经理岗位最终评委。必须只输出合法 JSON，不要输出 Markdown 或解释性文字。",
    user,
    temperature: 0.1
  });
  const parsed = parseJsonObject<Omit<Evaluation, "id" | "candidate_id" | "created_at" | "model_provider">>(result.content);
  return {
    ...parsed,
    scores: parsed.scores ?? {},
    risk_tags: parsed.risk_tags ?? [],
    evidence_summary: parsed.evidence_summary ?? [],
    model_provider: input.provider
  };
}

function normalizeAbilityPlan(plan: AbilityPlan): AbilityPlan {
  const total = plan.dimensions.reduce((sum, item) => sum + Number(item.weight || 0), 0) || 1;
  return {
    ...plan,
    dimensions: plan.dimensions.map((item) => ({
      ...item,
      weight: Math.round((Number(item.weight || 0) / total) * 100)
    })),
    agent_participation: plan.agent_participation ?? [],
    question_strategy: plan.question_strategy ?? []
  };
}

function normalizeTurnScore(
  parsed: Omit<TurnScore, "id" | "candidate_id" | "message_id" | "stage_id" | "model_provider" | "created_at">,
  dimensions: AbilityDimension[]
) {
  if (!parsed.scores || typeof parsed.scores !== "object") throw new Error("Turn score model response missing scores.");
  const scores: Record<string, number> = {};
  for (const dimension of dimensions) {
    const raw = Number(parsed.scores[dimension.key]);
    scores[dimension.key] = Number((Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0).toFixed(1));
  }
  const average_score = Number((Number(parsed.average_score) || averageFromScores(scores)).toFixed(1));
  return {
    scores,
    average_score,
    recommendation: parsed.recommendation ?? (average_score >= 80 ? "通过" : average_score >= 65 ? "继续观察" : "Cut"),
    risk_tags: Array.isArray(parsed.risk_tags) ? parsed.risk_tags : [],
    reason_summary: parsed.reason_summary || "模型已完成本轮评分。",
    next_question_standard: parsed.next_question_standard || "围绕低分维度继续追问，并要求候选人补充取舍、证据和落地边界。"
  };
}

function averageFromScores(scores: Record<string, number>) {
  const values = Object.values(scores);
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
