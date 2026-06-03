import { NextResponse } from "next/server";
import { jsonError } from "@/lib/apiUtils";
import { getReviewerStage } from "@/lib/reviewerAssessment";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string; stage: string } }) {
  try {
    const stage = params.stage === "ability" ? "ability" : params.stage === "final" ? "final" : "basic";
    const detail = await getReviewerStage(params.id, stage);
    if (!detail) return NextResponse.json({ error: "candidate_not_found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (error) {
    return jsonError(error, "reviewer_stage_failed");
  }
}
