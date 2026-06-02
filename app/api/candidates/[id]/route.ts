import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const store = await readStore();
  const candidate = store.candidates.find((item) => item.id === params.id);
  if (!candidate) return NextResponse.json({ error: "candidate not found" }, { status: 404 });

  const targetRole = candidate.target_role ?? "AI 产品经理";
  const enabledAgents = store.agents.filter((item) => item.status === "enabled");
  const roleAgents = enabledAgents.filter((item) => item.target_role === targetRole);

  return NextResponse.json(
    {
      candidate,
      stages: store.stages.filter((item) => item.candidate_id === params.id),
      messages: store.messages.filter((item) => item.candidate_id === params.id),
      workspaceMessages: store.workspaceMessages.filter((item) => item.candidate_id === params.id),
      eventLogs: store.eventLogs.filter((item) => item.candidate_id === params.id),
      turnScores: store.turnScores.filter((item) => item.candidate_id === params.id),
      agents: roleAgents.length ? roleAgents : enabledAgents,
      evaluation: store.evaluations.find((item) => item.candidate_id === params.id)
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
