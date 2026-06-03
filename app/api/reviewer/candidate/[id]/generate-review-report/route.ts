import { NextResponse } from "next/server";
import { finalSubmit } from "@/lib/assessmentFlow";
import { jsonError, readJson } from "@/lib/apiUtils";
import { getCandidateDetail } from "@/lib/repositories/candidates";
import { ModelProvider } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ model_provider?: ModelProvider }>(request);
    const candidate = await getCandidateDetail(params.id);
    if (!candidate) return NextResponse.json({ error: "candidate_not_found" }, { status: 404 });
    if (!candidate.final_solution) return NextResponse.json({ error: "final_solution_missing", message: "候选人尚未提交最终方案。" }, { status: 400 });
    const report = await finalSubmit(candidate, {
      final_solution: candidate.final_solution,
      ai_usage_note: candidate.ai_usage_note ?? "",
      provider: body.model_provider === "openai" ? "openai" : candidate.selected_model ?? "deepseek"
    });
    return NextResponse.json({ report });
  } catch (error) {
    return jsonError(error, "reviewer_generate_review_report_failed");
  }
}
