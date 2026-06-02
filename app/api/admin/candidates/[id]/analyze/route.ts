import { NextResponse } from "next/server";
import crypto from "crypto";
import { analyzePersonaWithDeepSeek } from "@/lib/ai";
import { getCandidateDetail, updateCandidateProfile } from "@/lib/repositories/candidates";
import { addEvent } from "@/lib/repositories/events";
import { jsonError } from "@/lib/apiUtils";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const candidate = await getCandidateDetail(params.id);
    if (!candidate) return NextResponse.json({ error: "candidate_not_found" }, { status: 404 });
    const persona = await analyzePersonaWithDeepSeek({
      candidateName: candidate.name,
      targetRole: candidate.target_role ?? "AI 产品经理",
      targetDifficulty: candidate.target_difficulty ?? "L2",
      resumeText: candidate.resume_text ?? "",
      interviewerEvaluations: candidate.interviewer_evaluations ?? []
    });
    const token = candidate.candidate_token ?? crypto.randomBytes(24).toString("hex");
    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
    const inviteUrl = `${baseUrl.replace(/\/$/, "")}/candidate/invite/${token}`;
    const updated = await updateCandidateProfile({ id: candidate.id, persona_profile: persona, invite_url: inviteUrl, candidate_token: token });
    await addEvent({
      candidate_id: candidate.id,
      event_type: "persona_profile_generated",
      raw_content: JSON.stringify({ resume_file_name: candidate.resume_file_name, interviewer_evaluations: candidate.interviewer_evaluations }),
      ai_summary: persona.summary,
      risk_tags: persona.risks
    });
    return NextResponse.json({ candidate: updated, invite_url: inviteUrl });
  } catch (error) {
    return jsonError(error, "persona_analyze_failed");
  }
}
