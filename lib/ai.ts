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

export async function analyzePersonaWithDeepSeek(input: {
  candidateName: string;
  targetRole: string;
  targetDifficulty: string;
  resumeText: string;
  interviewerEvaluations: InterviewerEvaluation[];
}) {
  const user = await loadPrompt("persona-profile.deepseek.md", {
    candidateName: input.candidateName,
    targetRole: input.targetRole,
    targetDifficulty: input.targetDifficulty,
    resumeText: input.resumeText,
    interviewerEvaluations: input.interviewerEvaluations
  });
  const result = await callModel({
    provider: "deepseek",
    system: "你是招聘场景的人才画像分析官。必须只输出合法 JSON。",
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
    agents: input.agents
  });
  const result = await callModel({
    provider: input.provider,
    system: "你是 AI 产品经理岗位考核策略官。必须只输出合法 JSON。",
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
}) {
  const promptName = input.stage.name === "能力关卡" ? "ability-stage-opening.deepseek.md" : "basic-stage-opening.deepseek.md";
  const user = await loadPrompt(promptName, {
    personaProfile: input.candidate.persona_profile ?? {},
    targetRole: input.targetRole,
    targetDifficulty: input.targetDifficulty,
    abilityDimensions: input.abilityDimensions
  });
  const result = await callModel({
    provider: input.provider,
    system: "你是 AI 产品经理岗位的 AI 考核官。必须只输出合法 JSON。",
    user,
    temperature: 0.25
  });
  const parsed = parseJsonObject<{ question: string }>(result.content);
  if (!parsed.question) throw new Error("Stage opening model response missing question.");
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
    stageName: input.stage?.name ?? "未进入关卡",
    abilityDimensions: input.candidate.ability_plan?.dimensions ?? [],
    candidateQuestion: input.userMessage
  });
  const result = await callModel({
    provider: input.modelProvider,
    system: "你是候选人的 AI 思考助手，不是考核官，不得代写最终提交。",
    user,
    temperature: 0.3
  });
  return result.content.trim();
}

export async function scoreTurn(input: {
  provider: ModelProvider;
  candidateAnswer: string;
  currentStage: Stage;
  abilityPlan: AbilityPlan;
  messageId: string;
  candidateId: string;
  elapsedSeconds: number;
  timeCoefficient: number;
}) {
  const promptName = input.provider === "openai" ? "turn-score.openai.md" : "turn-score.deepseek.md";
  const user = await loadPrompt(promptName, {
    stageName: input.currentStage.name,
    abilityDimensions: input.abilityPlan.dimensions,
    candidateAnswer: input.candidateAnswer,
    elapsedSeconds: input.elapsedSeconds,
    timeCoefficient: input.timeCoefficient
  });
  const result = await callModel({
    provider: input.provider,
    system: "你是 AI 产品经理岗位逐轮评分器。必须只输出合法 JSON。",
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
  const promptName = input.provider === "openai" ? "follow-up.openai.md" : "follow-up.deepseek.md";
  const user = await loadPrompt(promptName, {
    stageName: input.currentStage.name,
    agentConfig: input.agentConfig,
    abilityDimensions: input.abilityPlan?.dimensions ?? [],
    conversationHistory: input.conversationHistory,
    turnScore: input.turnScore ?? {},
    candidateAnswer: input.candidateAnswer
  });
  const result = await callModel({
    provider: input.provider,
    system: "你是 AI 产品经理岗位考核官。必须只输出合法 JSON。",
    user,
    temperature: 0.3
  });
  return parseJsonObject<{
    question: string;
    event_type: "ai_question" | "pressure_added";
    risk_tags: string[];
    target_dimensions: string[];
  }>(result.content);
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
  const promptName = input.provider === "openai" ? "final-evaluation.openai.md" : "final-evaluation.deepseek.md";
  const user = await loadPrompt(promptName, {
    personaProfile: input.candidateInfo.persona_profile ?? {},
    resumeText: input.candidateInfo.resume_text ?? "",
    interviewerEvaluations: input.interviewerEvaluations,
    conversationHistory: input.messages,
    eventLogs: input.eventLogs,
    turnScores: input.turnScores,
    finalSolution: input.finalSolution,
    aiUsageNote: input.aiUsageNote,
    abilityDimensions: input.candidateInfo.ability_plan?.dimensions ?? []
  });
  const result = await callModel({
    provider: input.provider,
    system: "你是 AI 产品经理岗位最终评委。必须只输出合法 JSON。",
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
    reason_summary: parsed.reason_summary,
    next_question_standard: parsed.next_question_standard
  };
}

function averageFromScores(scores: Record<string, number>) {
  const values = Object.values(scores);
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
