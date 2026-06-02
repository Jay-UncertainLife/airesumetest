import { NextResponse } from "next/server";
import { getCandidateByToken, updateCandidate } from "@/lib/repositories/candidates";
import { addEvent } from "@/lib/repositories/events";
import { createStage, listStages, resetStages } from "@/lib/repositories/stages";
import { stageDurations } from "@/lib/stages";
import { jsonError } from "@/lib/apiUtils";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: { token: string } }) {
  try {
    const candidate = await getCandidateByToken(params.token);
    if (!candidate) return NextResponse.json({ error: "invalid_invite_token" }, { status: 404 });
    if (!candidate.persona_profile) return NextResponse.json({ error: "candidate_not_ready" }, { status: 400 });

    const existing = await listStages(candidate.id);
    if (existing.length === 0) {
      await resetStages(candidate.id);
      await createStage({ candidate_id: candidate.id, name: "面试关卡准备", status: "in_progress", target_duration_seconds: 0, started_at: new Date().toISOString() });
      await createStage({ candidate_id: candidate.id, name: "基础关卡", status: "not_started", target_duration_seconds: stageDurations["基础关卡"] });
      await createStage({ candidate_id: candidate.id, name: "能力关卡", status: "not_started", target_duration_seconds: stageDurations["能力关卡"] });
    }
    await updateCandidate(candidate.id, { status: "in_progress" });
    await addEvent({
      candidate_id: candidate.id,
      event_type: "candidate_invite_started",
      raw_content: "候选人通过专属链接开始考核"
    });
    return NextResponse.json({ candidate_id: candidate.id, next_url: "/candidate/prep" });
  } catch (error) {
    return jsonError(error, "candidate_invite_start_failed");
  }
}
