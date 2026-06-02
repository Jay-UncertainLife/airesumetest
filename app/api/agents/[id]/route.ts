import { NextResponse } from "next/server";
import { deleteAgent, getAgent, updateAgent } from "@/lib/repositories/agents";
import { jsonError, readJson } from "@/lib/apiUtils";
import { Agent } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const agent = await getAgent(params.id);
    if (!agent) return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
    return NextResponse.json({ agent });
  } catch (error) {
    return jsonError(error, "agent_detail_failed");
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<Partial<Agent>>(request);
    const agent = await updateAgent(params.id, body);
    return NextResponse.json({ agent });
  } catch (error) {
    return jsonError(error, "agent_update_failed");
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await deleteAgent(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "agent_delete_failed");
  }
}
