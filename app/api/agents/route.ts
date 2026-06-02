import { NextResponse } from "next/server";
import { createAgent, listAgents } from "@/lib/repositories/agents";
import { jsonError, readJson } from "@/lib/apiUtils";
import { Agent } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ agents: await listAgents() });
  } catch (error) {
    return jsonError(error, "agents_list_failed");
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Partial<Agent>>(request);
    const agent = await createAgent({
      name: body.name?.trim() || "自定义考核官",
      target_role: body.target_role?.trim() || "AI 产品经理",
      agent_role: body.agent_role ?? "custom",
      model_provider: body.model_provider ?? "deepseek",
      model_name: body.model_name?.trim() || (body.model_provider === "openai" ? "gpt-4o-mini" : "deepseek-chat"),
      persona: body.persona?.trim() || "直接、追问型、业务结果导向",
      responsibility: body.responsibility?.trim() || "自定义考核分工",
      exam_goal: body.exam_goal?.trim() || "评估候选人是否具备 AI 产品经理岗位能力。",
      opening_prompt: body.opening_prompt?.trim() || "请候选人在限定时间内完成 AI 产品 MVP 方案。",
      follow_up_rules: body.follow_up_rules?.trim() || "围绕用户、场景、闭环、取舍、落地方式追问。",
      pressure_rules: body.pressure_rules?.trim() || "加入时间、人力、技术和误判约束。",
      scoring_rubric: body.scoring_rubric?.trim() || "按能力维度和岗位匹配度评分。",
      cut_rules: body.cut_rules?.trim() || "若无法说明核心闭环、取舍失控或方案不可落地，建议 Cut。",
      status: body.status ?? "enabled"
    });
    return NextResponse.json({ agent });
  } catch (error) {
    return jsonError(error, "agent_create_failed");
  }
}
