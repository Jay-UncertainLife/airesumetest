import { promises as fs } from "fs";
import path from "path";
import { ModelProvider } from "./types";

type ChatOptions = {
  provider: ModelProvider;
  system: string;
  user: string;
  temperature?: number;
};

export async function callModel(options: ChatOptions): Promise<string | null> {
  try {
    if (options.provider === "openai") return await callOpenAI(options);
    return await callDeepSeek(options);
  } catch {
    return null;
  }
}

async function callOpenAI(options: ChatOptions) {
  const apiKey = await readKey("OPENAI_API_KEY", "chat_key.txt");
  if (!apiKey) return null;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: options.temperature ?? 0.2,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user }
      ]
    })
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? null;
}

async function callDeepSeek(options: ChatOptions) {
  const apiKey = await readKey("DEEPSEEK_API_KEY", "DS-key.txt");
  if (!apiKey) return null;
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
      temperature: options.temperature ?? 0.2,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user }
      ]
    })
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? null;
}

async function readKey(envName: string, fileName: string) {
  if (process.env[envName]) return process.env[envName];
  try {
    const raw = await fs.readFile(path.join(process.cwd(), fileName), "utf8");
    return raw.trim();
  } catch {
    return "";
  }
}

export function parseJsonObject<T>(text: string | null): T | null {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
