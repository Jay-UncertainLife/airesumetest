import { NextResponse } from "next/server";
import { generateWorkspaceReply } from "@/lib/ai";
import { assertCandidateToken, jsonError, readJson, tokenFromRequest } from "@/lib/apiUtils";
import { updateCandidate } from "@/lib/repositories/candidates";
import { addEvent } from "@/lib/repositories/events";
import { addWorkspaceMessage } from "@/lib/repositories/messages";
import { getActiveStage } from "@/lib/repositories/stages";
import { ModelProvider } from "@/lib/types";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ content: string; model_provider?: ModelProvider; candidate_token?: string }>(request);
    const candidate = await assertCandidateToken(params.id, tokenFromRequest(request, body));
    const provider = body.model_provider === "openai" ? "openai" : "deepseek";
    const currentStage = await getActiveStage(params.id);
    await updateCandidate(candidate.id, { selected_model: provider });

    const userMessage = await addWorkspaceMessage({
      candidate_id: params.id,
      stage_id: currentStage?.id,
      role: "candidate",
      model_provider: provider,
      content: body.content
    });
    await addEvent({
      candidate_id: params.id,
      stage_id: currentStage?.id,
      event_type: "workspace_model_call_started",
      raw_content: `${provider}: ${body.content}`,
      ai_summary: `正在调用 ${provider} 生成模型交互回复。`
    });
    const answer = await generateWorkspaceReply({
      candidate,
      stage: currentStage ?? undefined,
      modelProvider: provider,
      userMessage: body.content
    });
    const modelMessage = await addWorkspaceMessage({
      candidate_id: params.id,
      stage_id: currentStage?.id,
      role: "model",
      model_provider: provider,
      content: answer
    });
    await addEvent({
      candidate_id: params.id,
      stage_id: currentStage?.id,
      event_type: "candidate_ai_workspace_chat",
      raw_content: `${provider}: ${body.content}`,
      ai_summary: answer
    });
    return NextResponse.json({ userMessage, modelMessage });
  } catch (error) {
    return jsonError(error, "workspace_chat_failed");
  }
}
