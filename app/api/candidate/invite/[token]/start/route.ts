import { NextResponse } from "next/server";
import { initializeAssessment } from "@/lib/assessmentFlow";
import { jsonError } from "@/lib/apiUtils";
import { getCandidateByToken } from "@/lib/repositories/candidates";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: { token: string } }) {
  try {
    const candidate = await getCandidateByToken(params.token);
    if (!candidate) return NextResponse.json({ error: "invalid_invite_token", message: "专属链接无效。" }, { status: 404 });
    if (!candidate.persona_profile) {
      return NextResponse.json({ error: "candidate_not_ready", message: "候选人画像尚未生成，暂不能进入考核。" }, { status: 400 });
    }
    if (!candidate.resume_text) {
      return NextResponse.json({ error: "candidate_resume_missing", message: "候选人简历尚未绑定，暂不能进入考核。" }, { status: 400 });
    }
    if (candidate.status === "assessment_completed" || candidate.status === "evaluated") {
      return NextResponse.json({ candidate_id: candidate.id, next_url: "/candidate/done" });
    }
    await initializeAssessment(candidate);
    return NextResponse.json({ candidate_id: candidate.id, next_url: "/candidate/arena" });
  } catch (error) {
    return jsonError(error, "candidate_invite_start_failed");
  }
}
