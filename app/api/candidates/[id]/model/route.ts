import { NextResponse } from "next/server";
import { assertCandidateToken, jsonError, readJson, tokenFromRequest } from "@/lib/apiUtils";
import { updateCandidate } from "@/lib/repositories/candidates";
import { addEvent } from "@/lib/repositories/events";
import { ModelProvider } from "@/lib/types";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ model_provider: ModelProvider; candidate_token?: string }>(request);
    const candidate = await assertCandidateToken(params.id, tokenFromRequest(request, body));
    const model = body.model_provider === "openai" ? "openai" : "deepseek";
    const updated = await updateCandidate(candidate.id, { selected_model: model });
    await addEvent({
      candidate_id: candidate.id,
      event_type: "model_selected",
      raw_content: `候选人选择模型：${model}`,
      ai_summary: "模型选择已留痕。"
    });
    return NextResponse.json({ candidate: updated });
  } catch (error) {
    return jsonError(error, "candidate_model_update_failed");
  }
}
