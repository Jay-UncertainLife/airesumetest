import { NextResponse } from "next/server";
import { callModel } from "@/lib/modelClients";
import { ModelProvider } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") === "openai" ? "openai" : "deepseek";
  return testProvider(provider);
}

async function testProvider(provider: ModelProvider) {
  const startedAt = Date.now();
  try {
    const result = await callModel({
      provider,
      system: "你是模型连通性诊断助手。只输出合法 JSON。",
      user: "请输出 {\"ok\":true,\"message\":\"model_ready\"}",
      temperature: 0
    });
    return NextResponse.json({
      ok: true,
      provider,
      model: result.model,
      latency_ms: Date.now() - startedAt,
      content_preview: result.content.slice(0, 200)
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      provider,
      latency_ms: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
