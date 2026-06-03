import { NextResponse } from "next/server";
import { assertCandidateToken, jsonError, tokenFromRequest } from "@/lib/apiUtils";
import { getAssessmentCurrent } from "@/lib/assessmentFlow";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const candidateId = url.searchParams.get("candidate_id");
    if (!candidateId) return NextResponse.json({ error: "candidate_id_required", message: "缺少候选人 ID。" }, { status: 400 });
    const candidate = await assertCandidateToken(candidateId, tokenFromRequest(request));
    return NextResponse.json(await getAssessmentCurrent(candidate));
  } catch (error) {
    return jsonError(error, "candidate_stage_current_failed");
  }
}
