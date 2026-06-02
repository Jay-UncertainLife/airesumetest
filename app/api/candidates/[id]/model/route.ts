import { NextResponse } from "next/server";
import { addEvent, readStore, writeStore } from "@/lib/store";
import { ModelProvider } from "@/lib/types";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { model_provider } = await request.json();
  if (!["deepseek", "openai"].includes(model_provider)) {
    return NextResponse.json({ error: "invalid model_provider" }, { status: 400 });
  }
  const store = await readStore();
  const candidate = store.candidates.find((item) => item.id === params.id);
  if (!candidate) return NextResponse.json({ error: "candidate not found" }, { status: 404 });
  candidate.selected_model = model_provider as ModelProvider;
  addEvent(store, {
    candidate_id: params.id,
    event_type: "model_selected",
    raw_content: `候选人切换对话模型：${model_provider}`,
    ai_summary: "模型切换已写入过程留痕"
  });
  await writeStore(store);
  return NextResponse.json({ candidate });
}
