import { NextResponse } from "next/server";
import { assertCandidateToken, jsonError, tokenFromRequest } from "@/lib/apiUtils";
import { listAgents } from "@/lib/repositories/agents";
import { getFinalEvaluation, listTurnScores } from "@/lib/repositories/evaluations";
import { listEvents } from "@/lib/repositories/events";
import { listMessages, listWorkspaceMessages } from "@/lib/repositories/messages";
import { listStages } from "@/lib/repositories/stages";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const candidate = await assertCandidateToken(params.id, tokenFromRequest(request));
    const [stages, messages, workspaceMessages, eventLogs, turnScores, agents, evaluation] = await Promise.all([
      listStages(params.id),
      listMessages(params.id),
      listWorkspaceMessages(params.id),
      listEvents(params.id),
      listTurnScores(params.id),
      listAgents(),
      getFinalEvaluation(params.id)
    ]);
    const enabledAgents = agents.filter((item) => item.status === "enabled");
    const roleAgents = enabledAgents.filter((item) => item.target_role === candidate.target_role);
    return NextResponse.json({
      candidate,
      stages,
      messages,
      workspaceMessages,
      eventLogs,
      turnScores,
      agents: roleAgents.length ? roleAgents : enabledAgents,
      evaluation
    });
  } catch (error) {
    return jsonError(error, "candidate_detail_failed");
  }
}
