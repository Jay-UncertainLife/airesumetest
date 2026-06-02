import { NextResponse } from "next/server";
import { callModel } from "@/lib/modelClients";
import { addEvent, readStore, writeStore } from "@/lib/store";
import { ModelProvider } from "@/lib/types";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { content, model_provider } = await request.json();
    const provider = (model_provider === "openai" ? "openai" : "deepseek") as ModelProvider;
    const store = await readStore();
    const candidate = store.candidates.find((item) => item.id === params.id);
    if (!candidate) return NextResponse.json({ error: "candidate not found" }, { status: 404 });
    candidate.selected_model = provider;

    const answer =
      (await callModel({
        provider,
        system: "你是 AI 产品经理岗位考核的候选人准备助手。回答要短，只围绕候选人画像、岗位能力和即将开始的闯关提醒。",
        user: `候选人画像：${JSON.stringify(candidate.persona_profile ?? {})}\n候选人问题：${content}`,
        temperature: 0.2
      })) ??
      `已记录你选择 ${provider}。基于当前画像，进入 AI 产品经理闯关时请重点说明：目标用户、AI 原生追问闭环、MVP 取舍、证据留痕和误判复核。`;

    addEvent(store, {
      candidate_id: params.id,
      event_type: "precheck_model_chat",
      raw_content: `${provider}: ${content}`,
      ai_summary: answer
    });
    await writeStore(store);
    return NextResponse.json({ answer, provider });
  } catch (error) {
    return NextResponse.json(
      { error: "precheck_chat_failed", message: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
