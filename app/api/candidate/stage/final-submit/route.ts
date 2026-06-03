import { NextResponse } from "next/server";
import { assertCandidateToken, jsonError, readJson, tokenFromRequest } from "@/lib/apiUtils";
import { finalSubmit } from "@/lib/assessmentFlow";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ candidate_id: string; candidate_token?: string; final_solution?: string; candidate_feedback?: string; ai_usage_note?: string }>(request);
    const candidate = await assertCandidateToken(body.candidate_id, tokenFromRequest(request, body));
    if (!body.final_solution?.trim()) return NextResponse.json({ error: "empty_final_solution", message: "最终方案不能为空。" }, { status: 400 });
    const report = await finalSubmit(candidate, {
      final_solution: body.final_solution,
      ai_usage_note: body.candidate_feedback ?? body.ai_usage_note ?? "",
      provider: "deepseek"
    });
    return NextResponse.json({ report });
  } catch (error) {
    return jsonError(error, "candidate_final_submit_failed");
  }
}
