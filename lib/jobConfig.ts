import { JobRole } from "./types";

export function defaultJobRole(): JobRole {
  const timestamp = now();
  return {
    id: id("job"),
    name: "AI 产品经理",
    difficulty: "L2",
    description: "面向 AI 产品经理岗位的小闭环考核，初始化难度为 L2。",
    enabled: true,
    created_at: timestamp,
    updated_at: timestamp,
    ability_dimensions: [
      { key: "ai_scene_identification", code: "P01", name: "AI 场景识别能力", weight: 12, target_level: "L2", description: "能不能判断哪个业务节点适合 AI 介入", observation: "是否能说清 AI 介入点" },
      { key: "user_scene_understanding", code: "P02", name: "用户场景理解能力", weight: 13, target_level: "L2", description: "能不能理解真实用户行为和使用动机", observation: "是否只站在业务方角度" },
      { key: "demand_clarification", code: "P03", name: "需求澄清能力", weight: 12, target_level: "L2", description: "能不能提出关键问题，收敛需求范围", observation: "是否问到目标、用户、指标、约束" },
      { key: "mvp_tradeoff", code: "P04", name: "MVP 取舍能力", weight: 16, target_level: "L2", description: "能不能在有限资源下保留最小验证闭环", observation: "是否能明确砍什么" },
      { key: "flow_design", code: "P05", name: "流程设计能力", weight: 13, target_level: "L2", description: "能不能设计任务流、状态流、审批流、反馈流", observation: "是否有完整闭环" },
      { key: "metric_design", code: "P06", name: "指标设计能力", weight: 10, target_level: "L2", description: "能不能定义成功标准和关键指标", observation: "是否有可验证指标" },
      { key: "feedback_loop", code: "P07", name: "反馈闭环设计能力", weight: 10, target_level: "L2", description: "能不能让用户行为、业务结果、AI 输出形成闭环", observation: "是否能持续优化" },
      { key: "rule_mechanism", code: "P08", name: "规则机制设计能力", weight: 14, target_level: "L2", description: "能不能把抽象原则变成系统规则", observation: "是否有明确触发、限制和例外" }
    ],
    basic_participation: [
      { ai_role: "AI 业务负责人", level: "P3", reason: "产品负责人必须先判断业务目标和价值" },
      { ai_role: "AI 用户", level: "P2", reason: "检查是否有用户视角和反馈处理" },
      { ai_role: "AI 开发", level: "P1", reason: "基础关只做轻量落地边界提醒" },
      { ai_role: "AI 治理元神", level: "P1", reason: "轻量检查 AI 个人边界和风险" },
      { ai_role: "AI 数据官", level: "P2", reason: "检查指标和反馈闭环" },
      { ai_role: "AI 压力官", level: "P1", reason: "基础关少量压力，避免过早压垮" },
      { ai_role: "AI 同事", level: "P1", reason: "补充需求冲突" },
      { ai_role: "AI 观察员", level: "P3", reason: "记录全过程" },
      { ai_role: "AI 评委", level: "P3", reason: "进行基本关卡评分" }
    ],
    ability_participation: [
      { ai_role: "AI 业务负责人", level: "P3", reason: "持续压业务目标和价值判断" },
      { ai_role: "AI 用户", level: "P2", reason: "检查用户视角和反馈处理" },
      { ai_role: "AI 开发", level: "P3", reason: "检查方案能否落到页面、字段、流程" },
      { ai_role: "AI 治理元神", level: "P2", reason: "检查 AI 个人边界和风险" },
      { ai_role: "AI 数据官", level: "P2", reason: "检查指标和反馈闭环" },
      { ai_role: "AI 压力官", level: "P2", reason: "检查 MVP 取舍" },
      { ai_role: "AI 同事", level: "P1", reason: "补充需求冲突" },
      { ai_role: "AI 观察员", level: "P3", reason: "记录全过程" },
      { ai_role: "AI 评委", level: "P3", reason: "进行能力维度评分" }
    ]
  };
}

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}
