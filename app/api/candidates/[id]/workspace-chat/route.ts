import { NextResponse } from "next/server";
import { generateWorkspaceReply } from "@/lib/ai";
import { addEvent, addWorkspaceMessage, readStore, writeStore } from "@/lib/store";
import { ModelProvider } from "@/lib/types";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { content, model_provider } = await request.json();
    const provider = (model_provider === "openai" ? "openai" : "deepseek") as ModelProvider;
    const store = await readStore();
    const candidate = store.candidates.find((item) => item.id === params.id);
    if (!candidate) return NextResponse.json({ error: "candidate not found" }, { status: 404 });
    const currentStage = store.stages.find((item) => item.candidate_id === params.id && item.status === "in_progress");
    candidate.selected_model = provider;

    const userMessage = addWorkspaceMessage(store, {
      candidate_id: params.id,
      stage_id: currentStage?.id,
      role: "candidate",
      model_provider: provider,
      content
    });
    const answer = await generateWorkspaceReply({
      candidate,
      stage: currentStage,
      modelProvider: provider,
      userMessage: content,
      history: store.messages.filter((item) => item.candidate_id === params.id)
    });
    const modelMessage = addWorkspaceMessage(store, {
      candidate_id: params.id,
      stage_id: currentStage?.id,
      role: "model",
      model_provider: provider,
      content: answer
    });
    addEvent(store, {
      candidate_id: params.id,
      stage_id: currentStage?.id,
      event_type: "candidate_ai_workspace_chat",
      raw_content: `${provider}: ${content}`,
      ai_summary: answer
    });
    await writeStore(store);
    return NextResponse.json({ userMessage, modelMessage });
  } catch (error) {
    return NextResponse.json(
      { error: "workspace_chat_failed", message: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
