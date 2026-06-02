import { NextResponse } from "next/server";
import { id, now, readStore, writeStore } from "@/lib/store";
import { Agent } from "@/lib/types";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ agents: store.agents });
}

export async function POST(request: Request) {
  const body = await request.json();
  const store = await readStore();
  const agent: Agent = {
    id: id("agent"),
    name: body.name,
    target_role: body.target_role,
    agent_role: body.agent_role ?? "custom",
    model_provider: body.model_provider ?? "deepseek",
    model_name: body.model_name ?? (body.model_provider === "openai" ? "gpt-4o-mini" : "deepseek-chat"),
    persona: body.persona,
    responsibility: body.responsibility ?? "自定义考核分工",
    exam_goal: body.exam_goal,
    opening_prompt: body.opening_prompt,
    follow_up_rules: body.follow_up_rules,
    pressure_rules: body.pressure_rules,
    scoring_rubric: body.scoring_rubric,
    cut_rules: body.cut_rules,
    status: body.status ?? "enabled",
    created_at: now()
  };
  store.agents.push(agent);
  await writeStore(store);
  return NextResponse.json({ agent });
}
