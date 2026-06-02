import crypto from "crypto";
import { Candidate, DifficultyLevel, InterviewerEvaluation, PersonaProfile } from "@/lib/types";
import { db, many, one } from "./db";

export type CandidateCreateInput = {
  name: string;
  target_role: string;
  target_difficulty: DifficultyLevel;
  resume_text: string;
  resume_file_name: string;
  interviewer_evaluations: InterviewerEvaluation[];
};

export async function listCandidates() {
  return many<Candidate>(
    db().from("candidates").select("*").order("created_at", { ascending: false })
  );
}

export async function createCandidate(input: CandidateCreateInput) {
  const candidate = await one<Candidate>(
    db()
      .from("candidates")
      .insert({
        name: input.name,
        target_role: input.target_role,
        target_difficulty: input.target_difficulty,
        status: "created",
        resume_text: input.resume_text,
        resume_file_name: input.resume_file_name,
        selected_model: "deepseek"
      })
      .select("*")
      .single()
  );
  if (!candidate) throw new Error("candidate_create_failed");

  if (input.interviewer_evaluations.length > 0) {
    const rows = input.interviewer_evaluations.map((item) => ({
      candidate_id: candidate.id,
      round_no: item.round_no,
      interviewer_name: item.interviewer_name,
      interview_stage: item.interview_stage,
      evaluation_text: item.evaluation_text,
      recommendation: item.recommendation
    }));
    const { error } = await db().from("interviewer_evaluations").insert(rows);
    if (error) throw new Error(error.message);
  }

  return getCandidateDetail(candidate.id);
}

export async function getCandidate(id: string) {
  return one<Candidate>(db().from("candidates").select("*").eq("id", id).single());
}

export async function getCandidateByToken(token: string) {
  return one<Candidate>(db().from("candidates").select("*").eq("candidate_token", token).single());
}

export async function getCandidateDetail(id: string) {
  const candidate = await getCandidate(id);
  if (!candidate) return null;
  const interviewer_evaluations = await listInterviewerEvaluations(id);
  return { ...candidate, interviewer_evaluations };
}

export async function listInterviewerEvaluations(candidateId: string) {
  return many<InterviewerEvaluation>(
    db().from("interviewer_evaluations").select("*").eq("candidate_id", candidateId).order("round_no", { ascending: true })
  );
}

export async function updateCandidateProfile(input: {
  id: string;
  persona_profile: PersonaProfile;
  invite_url: string;
  candidate_token?: string;
}) {
  const token = input.candidate_token ?? crypto.randomBytes(24).toString("hex");
  return one<Candidate>(
    db()
      .from("candidates")
      .update({
        persona_profile: input.persona_profile,
        candidate_token: token,
        invite_url: input.invite_url,
        status: "invited",
        updated_at: new Date().toISOString()
      })
      .eq("id", input.id)
      .select("*")
      .single()
  );
}

export async function updateCandidate(id: string, patch: Partial<Candidate>) {
  return one<Candidate>(
    db().from("candidates").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single()
  );
}

export function publicInviteFromCandidate(candidate: Candidate) {
  return {
    candidate_id: candidate.id,
    name: candidate.name,
    target_role: candidate.target_role,
    target_difficulty: candidate.target_difficulty,
    status: candidate.status,
    whether_ready: Boolean(candidate.persona_profile && candidate.candidate_token)
  };
}
