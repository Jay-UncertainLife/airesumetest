import { promises as fs } from "fs";
import path from "path";
import { PromptName } from "./types";

export async function loadPrompt(name: PromptName, variables: Record<string, unknown>) {
  const filePath = path.join(process.cwd(), "prompts", name);
  let text = await fs.readFile(filePath, "utf8");
  for (const [key, value] of Object.entries(variables)) {
    const printable = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    text = text.replaceAll(`{{${key}}}`, printable ?? "");
  }
  return text;
}
