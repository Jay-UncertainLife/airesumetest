import { StageName } from "./types";

export function normalizeStageName(name: string): StageName {
  if (name === "能力关卡" || name.includes("能力") || name.includes("鑳藉姏")) return "能力关卡";
  if (name === "基础关卡" || name.includes("基础") || name.includes("鍩虹")) return "基础关卡";
  return "面试关卡准备";
}

export function stageRank(name: string) {
  const normalized = normalizeStageName(name);
  if (normalized === "能力关卡") return 3;
  if (normalized === "基础关卡") return 2;
  return 1;
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
