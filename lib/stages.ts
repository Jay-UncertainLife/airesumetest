import { ParticipationLevel, StageName } from "./types";

export const stageCopy: Record<StageName, { goal: string; task: string }> = {
  面试关卡准备: {
    goal: "确认目标岗位、难度、AI 考核官参与度、能力维度和候选人画像。",
    task: "系统将基于岗位配置、候选人简历画像和 AI 考核官参与度生成基础关卡与能力关卡策略。"
  },
  基础关卡: {
    goal: "确认候选人是否理解角色职责、业务目标和问题拆解。",
    task:
      "你是一名 AI 产品经理。公司准备做一个面向招聘考核场景的 AI 考核产品，请你在 10 分钟内提出一个 MVP 方案。请说明：目标用户是谁？核心场景是什么？为什么它不是普通面试系统？MVP 最小闭环是什么？你会先做哪些功能，砍掉哪些功能？"
  },
  能力关卡: {
    goal: "制造约束，观察候选人的判断力、抗压能力、优先级能力和 AI 使用能力。",
    task:
      "现在老板要求两周内上线可演示版本，但研发只有 1 名前端、1 名后端，AI 能力只能调用现成 API。请你重新调整方案，并说明：你会砍掉什么？哪个功能必须保留？没有录屏怎么保留证据？AI 评委误判怎么办？如何避免候选人纯靠 AI 代答？如果只能做 3 个页面，你选哪 3 个？"
  }
};

export const stageDurations: Record<StageName, number> = {
  面试关卡准备: 0,
  基础关卡: 10 * 60,
  能力关卡: 12 * 60
};

export function calculateTimeCoefficient(elapsedSeconds: number, targetSeconds: number) {
  if (!targetSeconds) return 1;
  if (elapsedSeconds <= targetSeconds * 1.1) return 1;
  if (elapsedSeconds <= targetSeconds * 1.25) return 0.95;
  if (elapsedSeconds <= targetSeconds * 1.5) return 0.85;
  if (elapsedSeconds <= targetSeconds * 2) return 0.7;
  return 0.5;
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
