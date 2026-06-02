import { NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const store = await readStore();
  const agent = store.agents.find((item) => item.id === params.id);
  if (!agent) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  return NextResponse.json({ agent });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const store = await readStore();
  const agent = store.agents.find((item) => item.id === params.id);
  if (!agent) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  Object.assign(agent, {
    name: body.name ?? agent.name,
    target_role: body.target_role ?? agent.target_role,
    agent_role: body.agent_role ?? agent.agent_role,
    model_provider: body.model_provider ?? agent.model_provider,
    model_name: body.model_name ?? agent.model_name,
    persona: body.persona ?? agent.persona,
    responsibility: body.responsibility ?? agent.responsibility,
    exam_goal: body.exam_goal ?? agent.exam_goal,
    opening_prompt: body.opening_prompt ?? agent.opening_prompt,
    follow_up_rules: body.follow_up_rules ?? agent.follow_up_rules,
    pressure_rules: body.pressure_rules ?? agent.pressure_rules,
    scoring_rubric: body.scoring_rubric ?? agent.scoring_rubric,
    cut_rules: body.cut_rules ?? agent.cut_rules,
    status: body.status ?? agent.status
  });
  await writeStore(store);
  return NextResponse.json({ agent });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const store = await readStore();
  const before = store.agents.length;
  store.agents = store.agents.filter((item) => item.id !== params.id);
  if (store.agents.length === before) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  await writeStore(store);
  return NextResponse.json({ ok: true });
}
