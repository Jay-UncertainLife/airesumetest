import { NextResponse } from "next/server";
import { getCandidateDetail } from "@/lib/repositories/candidates";
import { listEvents } from "@/lib/repositories/events";
import { getFinalEvaluation, listTurnScores } from "@/lib/repositories/evaluations";
import { listMessages, listWorkspaceMessages } from "@/lib/repositories/messages";
import { listStages } from "@/lib/repositories/stages";
import { jsonError } from "@/lib/apiUtils";
import { buildStageRecords } from "@/lib/stageRecords";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const candidate = await getCandidateDetail(params.id);
    if (!candidate) return NextResponse.json({ error: "candidate_not_found" }, { status: 404 });
    const [stages, messages, workspaceMessages, eventLogs, turnScores, finalEvaluation] = await Promise.all([
      listStages(params.id),
      listMessages(params.id),
      listWorkspaceMessages(params.id),
      listEvents(params.id),
      listTurnScores(params.id),
      getFinalEvaluation(params.id)
    ]);
    const stageRecords = buildStageRecords({ stages, messages, workspaceMessages, eventLogs, turnScores });
    return NextResponse.json({ candidate, stages, messages, workspaceMessages, eventLogs, turnScores, finalEvaluation, stageRecords });
  } catch (error) {
    return jsonError(error, "admin_candidate_detail_failed");
  }
}
