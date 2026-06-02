import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const store = await readStore();
  const candidate = store.candidates.find((item) => item.id === params.id);
  if (!candidate) return NextResponse.json({ error: "candidate not found" }, { status: 404 });
  return NextResponse.json({
    candidate,
    stages: store.stages.filter((item) => item.candidate_id === params.id),
    messages: store.messages.filter((item) => item.candidate_id === params.id),
    workspaceMessages: store.workspaceMessages.filter((item) => item.candidate_id === params.id),
    eventLogs: store.eventLogs.filter((item) => item.candidate_id === params.id),
    turnScores: store.turnScores.filter((item) => item.candidate_id === params.id),
    agents: store.agents.filter((item) => item.status === "enabled" && item.target_role === "AI 产品负责人"),
    evaluation: store.evaluations.find((item) => item.candidate_id === params.id)
  });
}
