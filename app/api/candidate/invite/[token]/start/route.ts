import { NextResponse } from "next/server";
import { getCandidateByToken, updateCandidate } from "@/lib/repositories/candidates";
import { addEvent } from "@/lib/repositories/events";
import { createStage, listStages, resetStages } from "@/lib/repositories/stages";
import { stageDurations } from "@/lib/stages";
import { ABILITY_STAGE, BASIC_STAGE, PREP_STAGE } from "@/lib/stageNames";
import { jsonError } from "@/lib/apiUtils";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: { token: string } }) {
  try {
    const candidate = await getCandidateByToken(params.token);
    if (!candidate) return NextResponse.json({ error: "invalid_invite_token", message: "专属链接无效。" }, { status: 404 });
    if (!candidate.persona_profile) return NextResponse.json({ error: "candidate_not_ready", message: "候选人画像尚未生成，暂不能进入考核。" }, { status: 400 });

    const existing = await listStages(candidate.id);
    if (existing.length === 0) {
      await resetStages(candidate.id);
      await createStage({ candidate_id: candidate.id, name: PREP_STAGE, status: "in_progress", target_duration_seconds: 0, started_at: new Date().toISOString() });
      await createStage({ candidate_id: candidate.id, name: BASIC_STAGE, status: "not_started", target_duration_seconds: stageDurations[BASIC_STAGE] });
      await createStage({ candidate_id: candidate.id, name: ABILITY_STAGE, status: "not_started", target_duration_seconds: stageDurations[ABILITY_STAGE] });
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
