import { NextResponse } from "next/server";
import { assertCandidateToken, jsonError, readJson, tokenFromRequest } from "@/lib/apiUtils";
import { submitAnswer } from "@/lib/assessmentFlow";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ candidate_id: string; candidate_token?: string; answer_text?: string; ai_usage_note?: string; client_submit_id?: string }>(request);
    const candidate = await assertCandidateToken(body.candidate_id, tokenFromRequest(request, body));
    return NextResponse.json(await submitAnswer(candidate, {
      answer_text: body.answer_text ?? "",
      ai_usage_note: body.ai_usage_note ?? "",
      client_submit_id: body.client_submit_id ?? `auto-${crypto.randomUUID()}`,
      submit_type: "auto_timeout"
    }));
  } catch (error) {
    return jsonError(error, "candidate_auto_submit_timeout_failed");
  }
}
