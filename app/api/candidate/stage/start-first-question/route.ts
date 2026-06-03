import { NextResponse } from "next/server";
import { assertCandidateToken, jsonError, readJson, tokenFromRequest } from "@/lib/apiUtils";
import { startFirstQuestion } from "@/lib/assessmentFlow";
import { ModelProvider } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ candidate_id: string; candidate_token?: string; model_provider?: ModelProvider }>(request);
    const candidate = await assertCandidateToken(body.candidate_id, tokenFromRequest(request, body));
    const provider = body.model_provider === "openai" ? "openai" : candidate.selected_model ?? "deepseek";
    return NextResponse.json(await startFirstQuestion(candidate, provider));
  } catch (error) {
    return jsonError(error, "candidate_start_first_question_failed");
  }
}
