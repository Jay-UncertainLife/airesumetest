import { promises as fs } from "fs";
import path from "path";
import { Agent, Candidate, Evaluation, EventLog, Message, Stage, Store, TurnScore, WorkspaceMessage } from "./types";
import { defaultJobRole } from "./jobConfig";

const storePath = path.join(process.cwd(), "data", "store.json");

declare global {
  // eslint-disable-next-line no-var
  var __AI_CUT_ARENA_STORE__: Store | undefined;
}

const emptyStore: Store = {
  candidates: [],
  agents: [],
  stages: [],
  messages: [],
  workspaceMessages: [],
  eventLogs: [],
  evaluations: [],
  turnScores: [],
  jobRoles: []
};

export function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function now() {
  return new Date().toISOString();
}

export async function readStore(): Promise<Store> {
  if (process.env.VERCEL) {
    globalThis.__AI_CUT_ARENA_STORE__ = normalizeStore(globalThis.__AI_CUT_ARENA_STORE__ ?? emptyStore);
    return globalThis.__AI_CUT_ARENA_STORE__;
  }
  await ensureStore();
  const raw = await fs.readFile(storePath, "utf8");
  const parsed = JSON.parse(stripBom(raw)) as Partial<Store>;
  const store = normalizeStore({ ...emptyStore, ...parsed });
  await writeStore(store);
  return store;
}

export async function writeStore(store: Store) {
  const normalized = normalizeStore(store);
  if (process.env.VERCEL) {
    globalThis.__AI_CUT_ARENA_STORE__ = normalized;
    return;
  }
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(normalized, null, 2), "utf8");
}

function normalizeStore(store: Store) {
  store.candidates = store.candidates ?? [];
  store.agents = store.agents ?? [];
  store.stages = store.stages ?? [];
  store.messages = store.messages ?? [];
  store.workspaceMessages = store.workspaceMessages ?? [];
  store.eventLogs = store.eventLogs ?? [];
  store.evaluations = store.evaluations ?? [];
  store.turnScores = store.turnScores ?? [];
  store.jobRoles = (store.jobRoles ?? []).map(normalizeJobRole);

  if (store.jobRoles.length === 0) {
    store.jobRoles.push(defaultJobRole());
  }

  if (store.agents.length === 0) {
    store.agents.push(...defaultAgents());
  } else {
    store.agents = normalizeAgents(store.agents);
    const requiredRoles = new Set(store.agents.map((agent) => agent.agent_role));
    const missingAgents = defaultAgents().filter((agent) => !requiredRoles.has(agent.agent_role));
    if (missingAgents.length > 0) store.agents.push(...missingAgents);
  }

  store.candidates = store.candidates.map((candidate) => ({
    ...candidate,
    target_role: normalizeTargetRole(candidate.target_role),
    final_recommendation: normalizeRecommendation(candidate.final_recommendation)
  }));
  return store;
}

function stripBom(text: string) {
  return text.replace(/^\uFEFF/, "");
}

async function ensureStore() {
  try {
    await fs.access(storePath);
  } catch {
    await writeStore(emptyStore);
  }
}

export function defaultAgents(): Agent[] {
  const created_at = now();
  return [
    {
      id: id("agent"),
      name: "AI 产品负责人考核官",
      target_role: "AI 产品经理",
      agent_role: "lead_examiner",
      model_provider: "deepseek",
      model_name: "deepseek-chat",
      persona: "直接、结构化、强闭环意识",
      responsibility: "主持关卡推进，综合能力维度与逐轮得分决定继续追问、进入下一关或 Cut。",
      exam_goal: "评估候选人是否具备 AI 产品经理的场景理解、MVP 收敛和业务判断能力。",
      opening_prompt: "请候选人在限定时间内设计一个面向招聘考核场景的 AI 产品 MVP。",
      follow_up_rules: "围绕用户、场景、闭环、取舍、AI 原生性追问。",
      pressure_rules: "在回答空泛或范围失控时追加时间、人力、KPI、误判和证据约束。",
      scoring_rubric: "按 AI 产品经理动态能力组合逐轮评分。",
      cut_rules: "如果候选人连续无法说明核心闭环、取舍失控或方案不可落地，建议 Cut。",
      status: "enabled",
      created_at
    },
    {
      id: id("agent"),
      name: "产品闭环评委",
      target_role: "AI 产品经理",
      agent_role: "product_judge",
      model_provider: "deepseek",
      model_name: "deepseek-chat",
      persona: "冷静、追根究底、关注 MVP 边界",
      responsibility: "评估产品定位、用户场景、最小闭环和功能取舍。",
      exam_goal: "识别候选人是否能把 AI 产品从想法压缩成可演示闭环。",
      opening_prompt: "聚焦 AI 产品 MVP 的闭环完整度。",
      follow_up_rules: "追问入口、核心动作、输出物、审核价值和砍掉项。",
      pressure_rules: "要求候选人用更少页面、更少接口完成同样闭环。",
      scoring_rubric: "产品闭环、优先级判断、AI 原生程度。",
      cut_rules: "若持续大而全或无法定义最小闭环，标记高风险。",
      status: "enabled",
      created_at
    },
    {
      id: id("agent"),
      name: "压力与落地评委",
      target_role: "AI 产品经理",
      agent_role: "pressure_judge",
      model_provider: "deepseek",
      model_name: "deepseek-chat",
      persona: "强压、现实、资源约束导向",
      responsibility: "制造时间、人力、技术、老板改需求等约束，观察候选人应变。",
      exam_goal: "判断候选人在两周、两人、现成 API 条件下是否能落地。",
      opening_prompt: "把方案压到两周可演示。",
      follow_up_rules: "追问技术边界、人力排期、验收标准和风险预案。",
      pressure_rules: "持续加入资源限制、误判风险、数据留痕要求。",
      scoring_rubric: "约束下应变、风险识别、落地能力。",
      cut_rules: "若无法取舍或无法说明落地路径，建议继续观察或 Cut。",
      status: "enabled",
      created_at
    },
    {
      id: id("agent"),
      name: "证据链评委",
      target_role: "AI 产品经理",
      agent_role: "evidence_judge",
      model_provider: "openai",
      model_name: "gpt-4o-mini",
      persona: "审慎、证据导向、关注可复核性",
      responsibility: "评估过程记录、模型切换留痕、AI 使用说明和人工复核依据。",
      exam_goal: "判断候选人是否理解 AI 考核产品的信任与可解释问题。",
      opening_prompt: "关注过程证据与审核可信度。",
      follow_up_rules: "追问如何留痕、如何回放、如何防止纯 AI 代答、如何处理误判。",
      pressure_rules: "取消录屏或压缩日志后，要求候选人重建证据链。",
      scoring_rubric: "证据链、风险识别、AI 使用边界。",
      cut_rules: "若完全忽略证据记录和人工复核，标记高风险。",
      status: "enabled",
      created_at
    }
  ];
}

function normalizeAgents(agents: Agent[]) {
  return agents.map((agent) => {
    const modelProvider = agent.model_provider ?? "deepseek";
    return {
      ...agent,
      name: cleanText(agent.name, fallbackAgentName(agent.agent_role)),
      target_role: normalizeTargetRole(agent.target_role),
      agent_role: agent.agent_role ?? "lead_examiner",
      model_provider: modelProvider,
      model_name: agent.model_name ?? (modelProvider === "openai" ? "gpt-4o-mini" : "deepseek-chat"),
      persona: cleanText(agent.persona, "直接、追问型、业务结果导向"),
      responsibility: cleanText(agent.responsibility, "主持关卡推进，综合能力维度与逐轮得分决定继续追问、进入下一关或 Cut。"),
      exam_goal: cleanText(agent.exam_goal, "评估候选人是否具备 AI 产品经理岗位的核心能力。"),
      opening_prompt: cleanText(agent.opening_prompt, "请候选人在限定时间内完成 AI 产品 MVP 方案。"),
      follow_up_rules: cleanText(agent.follow_up_rules, "围绕用户、场景、闭环、取舍、落地方式追问。"),
      pressure_rules: cleanText(agent.pressure_rules, "加入时间、人力、技术和误判约束。"),
      scoring_rubric: cleanText(agent.scoring_rubric, "按能力维度和岗位匹配度评分。"),
      cut_rules: cleanText(agent.cut_rules, "若无法说明核心闭环、取舍失控或方案不可落地，建议 Cut。"),
      status: agent.status ?? "enabled"
    };
  });
}

function normalizeJobRole(job: Store["jobRoles"][number]) {
  const fallback = defaultJobRole();
  const hasCorruptedRows =
    !job.basic_participation?.length ||
    job.basic_participation.some((row) => isCorruptedText(row.ai_role) || isCorruptedText(row.reason));
  const hasCorruptedDimensions =
    !job.ability_dimensions?.length ||
    job.ability_dimensions.some((item) => isCorruptedText(item.name) || isCorruptedText(item.description) || isCorruptedText(item.observation));
  return {
    ...fallback,
    ...job,
    name: normalizeTargetRole(job.name),
    description: cleanText(job.description, fallback.description),
    ability_dimensions: hasCorruptedDimensions ? fallback.ability_dimensions : job.ability_dimensions,
    basic_participation: hasCorruptedRows ? fallback.basic_participation : job.basic_participation.slice(0, 4),
    ability_participation: hasCorruptedRows ? fallback.ability_participation : job.ability_participation.slice(0, 4)
  };
}

function normalizeTargetRole(role?: string) {
  if (!role || role.includes("产品负责人") || role.includes("浜у搧") || role.includes("璐熻矗") || isCorruptedText(role)) return "AI 产品经理";
  return role;
}

function normalizeRecommendation(value?: string) {
  if (!value) return undefined;
  if (value === "Cut") return "Cut";
  if (value.includes("观察") || value.includes("瑙傚療")) return "继续观察";
  if (value.includes("通过") || value.includes("閫氳繃")) return "通过";
  return undefined;
}

function cleanText(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  if (isCorruptedText(value)) return fallback;
  return value;
}

function isCorruptedText(value?: string) {
  return Boolean(value && /[\uFFFD]|[鐨勷汉鍔濮璐熻矗]|[ÃÂäåæçèéãï¼½]/.test(value));
}

function fallbackAgentName(role: Agent["agent_role"]) {
  const names: Record<Agent["agent_role"], string> = {
    lead_examiner: "AI 产品负责人考核官",
    product_judge: "产品闭环评委",
    pressure_judge: "压力与落地评委",
    evidence_judge: "证据链评委",
    custom: "自定义考核官"
  };
  return names[role ?? "custom"];
}

export function addEvent(
  store: Store,
  event: Omit<EventLog, "id" | "created_at">
) {
  const record: EventLog = { ...event, id: id("event"), created_at: now() };
  store.eventLogs.push(record);
  return record;
}

export function addMessage(store: Store, message: Omit<Message, "id" | "created_at">) {
  const record: Message = { ...message, id: id("msg"), created_at: now() };
  store.messages.push(record);
  return record;
}

export function addWorkspaceMessage(store: Store, message: Omit<WorkspaceMessage, "id" | "created_at">) {
  const record: WorkspaceMessage = { ...message, id: id("workmsg"), created_at: now() };
  store.workspaceMessages.push(record);
  return record;
}

export function addCandidate(store: Store, name: string): Candidate {
  const candidate: Candidate = {
    id: id("cand"),
    name,
    status: "created",
    created_at: now()
  };
  store.candidates.push(candidate);
  return candidate;
}

export function addTurnScore(store: Store, score: Omit<TurnScore, "id" | "created_at">) {
  const record: TurnScore = { ...score, id: id("turn"), created_at: now() };
  store.turnScores.push(record);
  return record;
}

export function addStage(store: Store, stage: Omit<Stage, "id">) {
  const record: Stage = { ...stage, id: id("stage") };
  store.stages.push(record);
  return record;
}

export function upsertEvaluation(store: Store, evaluation: Evaluation) {
  store.evaluations = store.evaluations.filter((item) => item.candidate_id !== evaluation.candidate_id);
  store.evaluations.push(evaluation);
}
