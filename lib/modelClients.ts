import { ModelCallResult, ModelProvider } from "./types";

type ChatOptions = {
  provider: ModelProvider;
  system: string;
  user: string;
  temperature?: number;
};

export class ModelCallError extends Error {
  provider: ModelProvider;

  constructor(provider: ModelProvider, message: string) {
    super(message);
    this.name = "ModelCallError";
    this.provider = provider;
  }
}

export async function callModel(options: ChatOptions): Promise<ModelCallResult> {
  if (options.provider === "openai") return callOpenAI(options);
  return callDeepSeek(options);
}

async function callOpenAI(options: ChatOptions): Promise<ModelCallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  if (!apiKey) throw new ModelCallError("openai", "OPENAI_API_KEY is not configured.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: options.temperature ?? 0.2,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user }
      ]
    })
  });

  if (!response.ok) {
    throw new ModelCallError("openai", `OpenAI request failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new ModelCallError("openai", "OpenAI response did not include message content.");
  return { provider: "openai", model, content };
}

async function callDeepSeek(options: ChatOptions): Promise<ModelCallResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  if (!apiKey) throw new ModelCallError("deepseek", "DEEPSEEK_API_KEY is not configured.");

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: options.temperature ?? 0.2,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user }
      ]
    })
  });

  if (!response.ok) {
    throw new ModelCallError("deepseek", `DeepSeek request failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new ModelCallError("deepseek", "DeepSeek response did not include message content.");
  return { provider: "deepseek", model, content };
}

export function parseJsonObject<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Model response did not contain a JSON object.");
  return JSON.parse(match[0]) as T;
}
