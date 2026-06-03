import { NextResponse } from "next/server";
import { jsonError } from "@/lib/apiUtils";
import { getReviewerOverview } from "@/lib/reviewerAssessment";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const overview = await getReviewerOverview(params.id);
    if (!overview) return NextResponse.json({ error: "candidate_not_found" }, { status: 404 });
    return NextResponse.json(overview);
  } catch (error) {
    return jsonError(error, "reviewer_overview_failed");
  }
}
