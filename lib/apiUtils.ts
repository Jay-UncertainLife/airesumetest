import { NextResponse } from "next/server";
import { getCandidate } from "./repositories/candidates";
import { ModelCallError } from "./modelClients";

export function jsonError(error: unknown, fallback = "request_failed") {
  if (error instanceof ModelCallError) {
    return NextResponse.json(
      { error: "model_call_failed", message: error.message, provider: error.provider },
      { status: 500 }
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ error: fallback, message }, { status: 500 });
}

export async function readJson<T>(request: Request): Promise<T> {
  const text = await request.text();
  return text ? JSON.parse(text) as T : {} as T;
}

export async function assertCandidateToken(candidateId: string, token?: string | null) {
  if (!token) throw new Error("candidate_token_required");
  const candidate = await getCandidate(candidateId);
  if (!candidate || candidate.candidate_token !== token) throw new Error("invalid_candidate_token");
  return candidate;
}

export function tokenFromRequest(request: Request, body?: { candidate_token?: string }) {
  return request.headers.get("x-candidate-token") ?? body?.candidate_token ?? "";
}
