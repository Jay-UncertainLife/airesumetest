import { NextResponse } from "next/server";
import { jsonError } from "@/lib/apiUtils";
import { getCandidateDetail } from "@/lib/repositories/candidates";
import { addCandidateProfile, getLatestCandidateProfile, getLatestFinalReviewReport } from "@/lib/repositories/assessment";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const candidate = await getCandidateDetail(params.id);
    if (!candidate) return NextResponse.json({ error: "candidate_not_found" }, { status: 404 });
    const report = await getLatestFinalReviewReport(params.id) as any;
    if (!report) return NextResponse.json({ error: "final_report_not_found", message: "请先生成评审报告。" }, { status: 400 });
    const profile = await addCandidateProfile({
      candidate_id: params.id,
      original_profile_json: candidate.persona_profile ?? {},
      updated_profile_json: report.final_profile_json ?? report,
      profile_comparison_json: { risk_points: report.risk_points, verification_focus_points: report.verification_focus_points },
      profile_summary: String(report.overall_comment ?? report.report_text ?? "")
    });
    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error, "reviewer_generate_final_profile_failed");
  }
}
