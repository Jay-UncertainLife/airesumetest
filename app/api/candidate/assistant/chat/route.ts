import { NextResponse } from "next/server";
import { assertCandidateToken, jsonError, readJson, tokenFromRequest } from "@/lib/apiUtils";
import { assistantChat } from "@/lib/assessmentFlow";
import { ModelProvider } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ candidate_id: string; candidate_token?: string; content?: string; model_provider?: ModelProvider }>(request);
    if (!body.content?.trim()) return NextResponse.json({ error: "empty_message", message: "消息不能为空。" }, { status: 400 });
    const candidate = await assertCandidateToken(body.candidate_id, tokenFromRequest(request, body));
    const provider = body.model_provider === "openai" ? "openai" : candidate.selected_model ?? "deepseek";
    return NextResponse.json(await assistantChat(candidate, body.content.trim(), provider));
  } catch (error) {
    return jsonError(error, "candidate_assistant_chat_failed");
  }
}
