import { StageName } from "./types";

export const PREP_STAGE: StageName = "面试关卡准备";
export const BASIC_STAGE: StageName = "基础关卡";
export const ABILITY_STAGE: StageName = "能力关卡";

export type StageKey = "basic" | "ability" | "final";

export function normalizeStageName(name: string): StageName {
  if (!name) return PREP_STAGE;
  const lower = name.toLowerCase();
  if (name === ABILITY_STAGE || name.includes("能力") || lower.includes("ability") || name.includes("鑳藉姏")) return ABILITY_STAGE;
  if (name === BASIC_STAGE || name.includes("基础") || lower.includes("basic") || name.includes("鍩虹")) return BASIC_STAGE;
  return PREP_STAGE;
}

export function stageRank(name: string) {
  const normalized = normalizeStageName(name);
  if (normalized === ABILITY_STAGE) return 3;
  if (normalized === BASIC_STAGE) return 2;
  return 1;
}

export function stageKey(name: string): StageKey | "prep" {
  const normalized = normalizeStageName(name);
  if (normalized === ABILITY_STAGE) return "ability";
  if (normalized === BASIC_STAGE) return "basic";
  return "prep";
}

export function stageNameFromKey(stage: StageKey): StageName | "最终评价" {
  if (stage === "basic") return BASIC_STAGE;
  if (stage === "ability") return ABILITY_STAGE;
  return "最终评价";
}

export function formatChinaTime(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}
