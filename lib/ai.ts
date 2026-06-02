import { stageCopy } from "./stages";
import {
  AbilityPlan,
  Agent,
  Candidate,
  Evaluation,
  EventLog,
  Message,
  ModelProvider,
  PersonaProfile,
  Recommendation,
  Stage,
  TurnScore
} from "./types";
import { id, now } from "./store";
import { callModel, parseJsonObject } from "./modelClients";

const severeRisks = ["目标不清", "范围失控", "无法取舍", "只会复述概念", "方案不可落地", "过度依赖 AI"];

export async function analyzeResumeWithDeepSeek(input: {
  name: string;
  resumeText: string;
}): Promise<PersonaProfile> {
  if (!input.resumeText.trim()) return mockPersonaProfile(input.resumeText);
  const text = await callModel({
    provider: "deepseek",
    system: "你是招聘场景的人才画像分析助手，只输出 JSON。",
    user: `请基于候选人简历，为 AI 产品经理考核生成画像。输出 JSON：{"summary":string,"strengths":string[],"risks":string[],"interview_focus":string[]}\n候选人：${input.name}\n简历：${input.resumeText}`,
    temperature: 0.1
  });
  const parsed = parseJsonObject<Omit<PersonaProfile, "source_model">>(text);
  return parsed ? { ...parsed, source_model: "deepseek" } : mockPersonaProfile(input.resumeText);
}

export async function generateAbilityPlanWithOpenAI(input: {
  targetRole: string;
  agents: Agent[];
  personaProfile?: PersonaProfile;
}): Promise<AbilityPlan> {
  const text = await callModel({
    provider: "openai",
    system: "你是 AI 产品经理岗位考核的出题策略官，只输出 JSON。",
    user: `请为“${input.targetRole}”生成动态能力维度和多 Agent 参与度组合。必须聚焦 AI 产品经理最小测试，不要扩展完整平台。输出 JSON：{"role":string,"dimensions":[{"key":string,"name":string,"weight":number,"description":string}],"agent_participation":[{"agent_role":string,"agent_name":string,"weight":number,"responsibility":string}],"question_strategy":string[]}\n可用 Agent：${JSON.stringify(input.agents.map(({ agent_role, name, responsibility }) => ({ agent_role, name, responsibility })))}\n候选人画像：${JSON.stringify(input.personaProfile ?? {})}`,
    temperature: 0.2
  });
  const parsed = parseJsonObject<Omit<AbilityPlan, "generated_by">>(text);
  return parsed ? normalizeAbilityPlan({ ...parsed, generated_by: "openai" }) : mockAbilityPlan(input.targetRole, input.agents);
}

export async function scoreTurnWithDeepSeek(input: {
  candidateAnswer: string;
  currentStage: Stage;
  abilityPlan: AbilityPlan;
  selectedModel: ModelProvider;
  messageId: string;
  candidateId: string;
  elapsedSeconds: number;
  timeCoefficient: number;
}): Promise<TurnScore> {
  const text = await callModel({
    provider: "deepseek",
    system: "你是 AI 产品经理岗位考核的逐轮评分器。必须只输出合法 JSON，不能输出 Markdown。",
    user: `请根据动态能力维度对候选人本轮作答评分。输出 JSON，格式必须严格为：{"scores":{"维度key":数字},"average_score":数字,"recommendation":"通过"|"继续观察"|"Cut","risk_tags":string[],"reason_summary":string,"next_question_standard":string}\n评分必须按 0-100 总分制，不是 1-5。每个 scores[key] 是该维度加权后的分数。基础关卡：80-100 通过，65-79 继续观察，低于65 Cut/复核。能力关卡：单项得分=min(实际等级/目标等级,1)*权重*时间系数。\n关卡：${input.currentStage.name}\n耗时秒数：${input.elapsedSeconds}\n时间系数：${input.timeCoefficient}\n能力维度：${JSON.stringify(input.abilityPlan.dimensions)}\n候选人回答：${input.candidateAnswer}`,
    temperature: 0.1
  });
  const parsed = parseJsonObject<Omit<TurnScore, "id" | "candidate_id" | "message_id" | "stage_id" | "model_provider" | "created_at">>(text);
  const result = normalizeTurnScore(parsed, input.abilityPlan) ?? mockTurnScore(input.candidateAnswer, input.abilityPlan, input.timeCoefficient);
  return {
    id: id("turn"),
    candidate_id: input.candidateId,
    message_id: input.messageId,
    stage_id: input.currentStage.id,
    elapsed_seconds: input.elapsedSeconds,
    time_coefficient: input.timeCoefficient,
    scores: result.scores,
    average_score: result.average_score,
    recommendation: result.recommendation,
    risk_tags: result.risk_tags,
    reason_summary: result.reason_summary,
    next_question_standard: result.next_question_standard,
    model_provider: parsed ? "deepseek" : "mock",
    created_at: now()
  };
}

function normalizeTurnScore(
  parsed: Omit<TurnScore, "id" | "candidate_id" | "message_id" | "stage_id" | "model_provider" | "created_at"> | null,
  abilityPlan: AbilityPlan
) {
  if (!parsed || !parsed.scores || typeof parsed.scores !== "object") return null;
  const scores: Record<string, number> = {};
  for (const dimension of abilityPlan.dimensions) {
    const raw = Number(parsed.scores[dimension.key]);
    scores[dimension.key] = Number((Number.isFinite(raw) ? Math.max(0, Math.min(raw, dimension.weight)) : 0).toFixed(1));
  }
  const average_score = Number(Object.values(scores).reduce((sum, value) => sum + value, 0).toFixed(1));
  return {
    scores,
    average_score,
    recommendation: scoreRecommendation(average_score),
    risk_tags: Array.isArray(parsed.risk_tags) ? parsed.risk_tags : [],
    reason_summary: parsed.reason_summary || "DS 已完成本轮维度评分。",
    next_question_standard: parsed.next_question_standard || (average_score >= 80 ? "进入下一轮追问。" : "围绕低分维度继续追问。")
  };
}

function scoreRecommendation(score: number): Recommendation {
  if (score >= 80) return "通过";
  if (score >= 65) return "继续观察";
  return "Cut";
}

export async function generateStageOpeningWithDeepSeek(input: {
  candidate: Candidate;
  stage: Stage;
  jobRoleName: string;
  difficulty: string;
  abilityPlan?: AbilityPlan;
}) {
  const fallback =
    input.stage.name === "基础关卡"
      ? `你正在投递 ${input.jobRoleName}（${input.difficulty}）。请基于你的简历背景，设计一个面向招聘场景的 AI 考核产品 MVP。请回答：目标用户是谁、AI 介入点是什么、最小闭环是什么、先砍掉哪些能力、如何记录候选人的决策与取舍。`
      : stageCopy[input.stage.name].task;

  const text = await callModel({
    provider: "deepseek",
    system: "你是 AI 产品经理岗位的 AI 考核官。请生成关卡开场题，只输出题目正文，不要解释。",
    user: `请基于候选人画像、目标岗位、难度和能力维度，生成一个不写死的${input.stage.name}开场题。\n候选人画像：${JSON.stringify(input.candidate.persona_profile ?? {})}\n目标岗位：${input.jobRoleName}\n难度：${input.difficulty}\n能力维度：${JSON.stringify(input.abilityPlan?.dimensions ?? [])}\n要求：问题必须匹配 L2 AI 产品经理，覆盖 P01-P08 中至少 4 个维度，并明确要求记录决策、修改、反驳、取舍和最终结果。`,
    temperature: 0.25
  });
  return text?.trim() || fallback;
}

export async function generateWorkspaceReply(input: {
  candidate: Candidate;
  stage?: Stage;
  modelProvider: ModelProvider;
  userMessage: string;
  history: Message[];
}) {
  const text = await callModel({
    provider: input.modelProvider,
    system: "你是候选人的 AI 思考助手，不是考核官。可以帮助候选人拆解问题、生成思路、指出风险，但不能代替候选人提交最终答案。回答要保留产品经理判断框架。",
    user: `候选人画像：${JSON.stringify(input.candidate.persona_profile ?? {})}\n目标岗位：${input.candidate.target_role ?? "AI 产品经理"} ${input.candidate.target_difficulty ?? "L2"}\n当前关卡：${input.stage?.name ?? "未进入关卡"}\n能力维度：${JSON.stringify(input.candidate.ability_plan?.dimensions ?? [])}\n候选人问题：${input.userMessage}`,
    temperature: 0.3
  });
  return text?.trim() || `我会建议你按“目标用户 -> AI 介入点 -> 最小闭环 -> 取舍 -> 证据留痕 -> 风险复核”来组织回答。注意：最终判断需要你自己确认，系统会记录这次 ${input.modelProvider} 辅助思考。`;
}

export async function generateFollowUp(input: {
  candidateAnswer: string;
  currentStage: Stage;
  agentConfig: Agent;
  conversationHistory: Message[];
  abilityPlan?: AbilityPlan;
  turnScore?: TurnScore;
  modelProvider: ModelProvider;
}) {
  if (input.turnScore?.recommendation === "Cut") {
    return {
      question: "本轮已经触发 Cut 风险。请你用 3 句话补救：核心闭环是什么、必须砍掉什么、如何保留证据？",
      event_type: "pressure_added" as const,
      risk_tags: input.turnScore.risk_tags
    };
  }

  const text = await callModel({
    provider: input.modelProvider,
    system: `你是${input.agentConfig.name}。${input.agentConfig.persona}。职责：${input.agentConfig.responsibility}`,
    user: `请基于本轮评分标准生成下一个追问。不要闲聊，只给一个尖锐问题。\n关卡：${input.currentStage.name}\n能力组合：${JSON.stringify(input.abilityPlan?.dimensions ?? [])}\n本轮评分：${JSON.stringify(input.turnScore ?? {})}\n候选人回答：${input.candidateAnswer}`,
    temperature: 0.3
  });
  if (text) {
    return {
      question: text.replace(/^["“]|["”]$/g, "").trim(),
      event_type: input.currentStage.name === "能力关卡" ? ("pressure_added" as const) : ("ai_question" as const),
      risk_tags: input.turnScore?.risk_tags ?? []
    };
  }

  const risks = input.turnScore?.risk_tags ?? [];
  if (input.currentStage.name === "能力关卡") {
    return {
      question:
        "我继续加一个限制：明天下午就要给 CEO 演示，而且不能做录屏。你现在只能保留 3 个页面和 1 个 AI 调用。请明确说出你砍掉什么、保留什么，以及如何留下可复核证据。",
      event_type: "pressure_added" as const,
      risk_tags: risks
    };
  }

  const followUps = [
    "你的方案里最容易变成“大而全平台”的部分是哪一个？请直接砍掉它，并说明为什么。",
    "如果审核人员只看 5 分钟，你打算用哪些过程证据证明候选人的真实能力？",
    "请把你的 MVP 闭环压缩成：入口、AI 追问、事件记录、最终评分、审核查看这 5 个节点。",
    "你提到了功能，但我还没看到明确目标用户。到底是谁在为这个系统付费并做判断？"
  ];
  const question = followUps[input.conversationHistory.length % followUps.length];
  return { question, event_type: "ai_question" as const, risk_tags: risks };
}

export function generateEvaluation(input: {
  candidateInfo: Candidate;
  messages: Message[];
  eventLogs: EventLog[];
  finalSolution: string;
  aiUsageNote: string;
  agentConfig: Agent;
  turnScores?: TurnScore[];
}): Evaluation {
  const text = `${input.messages.map((m) => m.content).join("\n")}\n${input.finalSolution}\n${input.aiUsageNote}`;
  const risks = new Set<string>();
  const score = (keywords: RegExp, fallback: number) => (keywords.test(text) ? fallback + 1 : fallback);

  if (!/用户|场景|招聘|审核/.test(text)) risks.add("目标不清");
  if (!/砍|不做|取舍|优先|保留/.test(text)) risks.add("无法取舍");
  if (!/事件|证据|记录|时间线|回放/.test(text)) risks.add("证据链不足");
  if (!/API|mock|两周|前端|后端|落地/.test(text)) risks.add("落地细节不足");
  if (/直接复制|全靠|让 AI 全部/.test(text)) risks.add("过度依赖 AI");

  const turnAverage = input.turnScores?.length
    ? input.turnScores.reduce((sum, item) => sum + item.average_score, 0) / input.turnScores.length
    : 0;
  const scores = {
    problem_understanding: clamp(score(/用户|场景|招聘|目标/, 3) - (risks.has("目标不清") ? 1 : 0)),
    product_loop: clamp(score(/闭环|登录|追问|提交|评分|审核/, 3)),
    priority_judgement: clamp(score(/砍|不做|取舍|优先|保留/, 2)),
    constraint_response: clamp(score(/两周|1 名|API|mock|限制|风险|误判/, 2)),
    expression_completeness: clamp(Math.round(turnAverage || (input.finalSolution.length > 240 ? 4 : 3)))
  };
  const average_score = Number(
    (Object.values(scores).reduce((sum, value) => sum + value, 0) / Object.values(scores).length).toFixed(1)
  );
  const hasSevere = Array.from(risks).some((risk) => severeRisks.includes(risk));
  const recommendation = hasSevere && average_score < 3.5 ? "Cut" : average_score >= 4 ? "通过" : average_score >= 3 ? "继续观察" : "Cut";

  return {
    id: id("eval"),
    candidate_id: input.candidateInfo.id,
    scores,
    average_score,
    risk_tags: Array.from(risks),
    recommendation,
    reason_summary:
      recommendation === "通过"
        ? "候选人能围绕小闭环说明目标、取舍、证据记录和审核判断，整体达到当前角色的 MVP 判断要求。"
        : recommendation === "继续观察"
          ? "候选人能覆盖主要闭环，但在约束下的取舍、证据保存或落地细节上仍需要进一步观察。"
          : "候选人在目标、取舍或落地逻辑上存在明显缺口，当前证据不足以支持通过。",
    evidence_summary: [
      `候选人在 ${stageCopy["基础关卡"].goal} 的任务中累计回答 ${input.messages.filter((m) => m.role === "candidate").length} 次。`,
      `系统记录了 ${input.eventLogs.length} 条过程事件和 ${input.turnScores?.length ?? 0} 条逐轮评分，可用于审核人员复核追问、回答、加压和最终提交。`
    ],
    created_at: now()
  };
}

function mockPersonaProfile(resumeText: string): PersonaProfile {
  return {
    summary: resumeText.trim()
      ? "候选人具备一定项目经历，需要通过 AI 产品经理任务验证其产品闭环、取舍和 AI 使用边界。"
      : "候选人未提交有效简历文本，画像可信度较低，需要在追问中补足背景信息。",
    strengths: ["可通过项目经历切入追问", "适合用 MVP 取舍题观察判断力"],
    risks: resumeText.trim() ? ["简历与岗位匹配度需要通过场景题验证"] : ["缺少简历证据"],
    interview_focus: ["AI 产品闭环", "MVP 取舍", "证据链设计", "模型误判处理"],
    source_model: "mock"
  };
}

function mockAbilityPlan(targetRole: string, agents: Agent[]): AbilityPlan {
  return {
    role: targetRole,
    generated_by: "mock",
    dimensions: [
      { key: "scenario_insight", name: "场景洞察", weight: 22, description: "是否理解招聘考核场景的真实用户和业务问题。" },
      { key: "product_loop", name: "产品闭环", weight: 26, description: "是否能把入口、追问、记录、评分、审核串成最小闭环。" },
      { key: "ai_native", name: "AI 原生设计", weight: 18, description: "是否体现 AI 追问、模型留痕和人机协作，而非普通表单。" },
      { key: "priority_cut", name: "优先级取舍", weight: 20, description: "是否能在两周和有限人力下明确砍掉项。" },
      { key: "evidence_risk", name: "证据与风险", weight: 14, description: "是否能处理误判、代答、留痕和人工复核。" }
    ],
    agent_participation: agents
      .filter((agent) => agent.status === "enabled")
      .map((agent) => ({
        agent_role: agent.agent_role,
        agent_name: agent.name,
        weight:
          agent.agent_role === "lead_examiner" ? 35 : agent.agent_role === "product_judge" ? 28 : agent.agent_role === "pressure_judge" ? 22 : 15,
        responsibility: agent.responsibility
      })),
    question_strategy: ["基础关卡先验证场景和闭环", "能力关卡加入两周、人力、API、误判和证据限制", "逐轮评分低于 2.5 时触发补救追问或 Cut"]
  };
}

function normalizeAbilityPlan(plan: AbilityPlan): AbilityPlan {
  const total = plan.dimensions.reduce((sum, item) => sum + Number(item.weight || 0), 0) || 1;
  return {
    ...plan,
    dimensions: plan.dimensions.map((item) => ({ ...item, weight: Math.round((Number(item.weight || 0) / total) * 100) }))
  };
}

function mockTurnScore(answer: string, abilityPlan: AbilityPlan, timeCoefficient = 1) {
  const risks: string[] = [];
  if (answer.trim().length < 80) risks.push("回答过短");
  if (!/用户|场景|招聘|审核|业务/.test(answer)) risks.push("场景洞察不足");
  if (!/闭环|入口|追问|记录|评分|提交/.test(answer)) risks.push("产品闭环不清");
  if (!/AI|模型|API|DeepSeek|OpenAI|留痕/.test(answer)) risks.push("AI 原生设计不足");
  if (!/砍|不做|取舍|优先|保留|三页|3 个/.test(answer)) risks.push("取舍不清");
  if (!/证据|误判|复核|风险|代答|记录/.test(answer)) risks.push("证据与风险不足");

  const scores = Object.fromEntries(
    abilityPlan.dimensions.map((dimension) => {
      const actualLevel =
        dimension.key === "scenario_insight"
          ? /用户|场景|招聘|审核|业务/.test(answer) ? 3 : 1
          : dimension.key === "product_loop"
            ? /闭环|入口|追问|记录|评分|提交/.test(answer) ? 3 : 1
            : dimension.key === "ai_native"
              ? /AI|模型|API|DeepSeek|OpenAI|留痕/.test(answer) ? 3 : 1
              : dimension.key === "priority_cut"
                ? /砍|不做|取舍|优先|保留|三页|3 个/.test(answer) ? 3 : 1
                : /证据|误判|复核|风险|代答|记录|规则|触发/.test(answer) ? 3 : 1;
      const targetLevel = levelValue(dimension.target_level ?? "L2");
      const weightedScore = Math.min(actualLevel / targetLevel, 1) * dimension.weight * timeCoefficient;
      return [dimension.key, Number(weightedScore.toFixed(1))];
    })
  );
  const average_score = Number(Object.values(scores).reduce((sum, value) => sum + value, 0).toFixed(1));
  return {
    scores,
    average_score,
    recommendation: average_score >= 80 ? "通过" : average_score >= 65 ? "继续观察" : "Cut",
    risk_tags: risks,
    reason_summary: risks.length ? `本轮主要风险：${risks.join("、")}。` : "本轮回答覆盖主要能力维度。",
    next_question_standard: average_score < 65 ? "低于 65 分，先要求候选人补齐核心闭环、取舍和证据链，再决定 Cut 或人工复核。" : "继续围绕低分维度追问。"
  } as const;
}

function levelValue(level: string) {
  return Number(level.replace("L", "")) || 2;
}

function clamp(value: number) {
  return Math.max(1, Math.min(5, value));
}
