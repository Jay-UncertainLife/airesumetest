import { NextResponse } from "next/server";
import { assertCandidateToken, jsonError, readJson, tokenFromRequest } from "@/lib/apiUtils";
import { saveDraft } from "@/lib/assessmentFlow";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ candidate_id: string; candidate_token?: string; draft_text?: string; ai_usage_note_draft?: string }>(request);
    const candidate = await assertCandidateToken(body.candidate_id, tokenFromRequest(request, body));
    return NextResponse.json({ draft: await saveDraft(candidate, { draft_text: body.draft_text ?? "", ai_usage_note_draft: body.ai_usage_note_draft ?? "" }) });
  } catch (error) {
    return jsonError(error, "candidate_save_draft_failed");
  }
}
