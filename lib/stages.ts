import { AbilityDimension, ParticipationLevel, StageName } from "./types";

export const basicStageDimensions: AbilityDimension[] = [
  {
    key: "task_reception",
    code: "B01",
    name: "任务接收关",
    weight: 20,
    target_level: "L2",
    description: "是否理解目标、对象、交付物和限制。",
    observation: "能否读懂任务并拆出边界。"
  },
  {
    key: "information_structuring",
    code: "B02",
    name: "信息整理关",
    weight: 20,
    target_level: "L2",
    description: "是否能把混乱信息整理成可执行结构。",
    observation: "能否输出结构化任务、步骤和依赖。"
  },
  {
    key: "ai_usage_trace",
    code: "B03",
    name: "AI 使用留痕关",
    weight: 20,
    target_level: "L2",
    description: "是否透明记录 AI 使用、采纳、否定和修改。",
    observation: "能否说明 AI 辅助边界和人工判断。"
  },
  {
    key: "change_response",
    code: "B04",
    name: "变化响应关",
    weight: 20,
    target_level: "L2",
    description: "是否能在新限制下做取舍和调整。",
    observation: "能否面对约束变化重新排序。"
  },
  {
    key: "final_delivery",
    code: "B05",
    name: "最终交付关",
    weight: 20,
    target_level: "L2",
    description: "是否能交付清楚、可复盘、可接手的结果。",
    observation: "能否形成可审核交付物。"
  }
];

export const stageCopy: Record<StageName, { goal: string; task: string }> = {
  面试关卡准备: {
    goal: "确认候选人画像、岗位和考核规则，准备进入正式作答。",
    task: "系统将基于候选人画像、简历、面试评价和岗位要求生成正式题目。"
  },
  基础关卡: {
    goal: "考察任务接收、信息整理、AI 使用留痕、变化响应和最终交付能力。",
    task: "围绕真实工作任务完成结构化作答，并说明 AI 使用过程。"
  },
  能力关卡: {
    goal: "考察岗位专项能力、约束下取舍、证据链、风险控制和落地能力。",
    task: "在真实业务限制中输出可执行方案，并说明取舍、验证和交付路径。"
  }
};

export const stageDurations: Record<StageName, number> = {
  面试关卡准备: 0,
  基础关卡: 10 * 60,
  能力关卡: 12 * 60
};

export const requiredQuestionsByStage = {
  basic: 5,
  ability: 3
} as const;

export function calculateTimeCoefficient(elapsedSeconds: number, targetSeconds: number) {
  if (!targetSeconds || elapsedSeconds <= targetSeconds * 1.1) return 1;
  if (elapsedSeconds <= targetSeconds * 1.25) return 0.95;
  if (elapsedSeconds <= targetSeconds * 1.5) return 0.85;
  if (elapsedSeconds <= targetSeconds * 2) return 0.7;
  return 0.5;
}

export function timeoutLevel(elapsedSeconds: number, targetSeconds: number) {
  if (!targetSeconds || elapsedSeconds <= targetSeconds) return "normal";
  if (elapsedSeconds <= targetSeconds * 1.1) return "slight";
  if (elapsedSeconds <= targetSeconds * 1.25) return "minor";
  if (elapsedSeconds <= targetSeconds * 1.5) return "obvious";
  if (elapsedSeconds <= targetSeconds * 2) return "serious";
  return "critical";
}

export const difficultyDefinitions = [
  { level: "L1", definition: "能理解", fit: "实习 / 初级", behavior: "能复述概念，指出明显问题" },
  { level: "L2", definition: "能执行", fit: "初级 / 1 年经验", behavior: "能按模板完成任务" },
  { level: "L3", definition: "能独立完成", fit: "中级", behavior: "能在模糊条件下输出可用方案" },
  { level: "L4", definition: "能处理复杂冲突", fit: "高级", behavior: "能在多方冲突、资源受限下做取舍" },
  { level: "L5", definition: "能设计机制", fit: "负责人 / 专家", behavior: "能抽象成系统规则、流程和组织机制" }
];

export const participationDefinitions: Record<ParticipationLevel, { definition: string; effect: string }> = {
  P0: { definition: "该关卡不需要这个 AI 角色介入", effect: "避免噪音" },
  P1: { definition: "只提出 1 个补充问题或边界提醒", effect: "补充视角" },
  P2: { definition: "作为辅助角色持续追问 2-3 次", effect: "制造压力" },
  P3: { definition: "作为主攻角色，主导本关挑战", effect: "核心考察来源" }
};
