import {
  AnswerDraft,
  AnswerSession,
  AssessmentAnswer,
  AssessmentQuestion,
  AssessmentStageKey,
  AssessmentState,
  CandidateStageProgress,
  ChatMessage,
  GenerationStatus,
  QuestionGenerationJob
} from "@/lib/assessmentTypes";
import { TurnScore } from "@/lib/types";
import { db, many, maybeOne, one } from "./db";

export async function listStageProgress(candidateId: string) {
  return many<CandidateStageProgress>(
    db().from("candidate_stage_progress").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: true })
  );
}

export async function getStageProgress(candidateId: string, stageKey: AssessmentStageKey) {
  return maybeOne<CandidateStageProgress>(
    db().from("candidate_stage_progress").select("*").eq("candidate_id", candidateId).eq("stage_key", stageKey).maybeSingle()
  );
}

export async function ensureStageProgress(input: {
  candidate_id: string;
  stage_key: AssessmentStageKey;
  current_state?: AssessmentState;
  target_duration_seconds?: number;
}) {
  const existing = await getStageProgress(input.candidate_id, input.stage_key);
  if (existing) return existing;
  return one<CandidateStageProgress>(
    db()
      .from("candidate_stage_progress")
      .insert({
        candidate_id: input.candidate_id,
        stage_key: input.stage_key,
        current_state: input.current_state ?? "INIT",
        target_duration_seconds: input.target_duration_seconds ?? null,
        generation_status: "pending"
      })
      .select("*")
      .single()
  );
}

export async function updateStageProgress(id: string, patch: Partial<CandidateStageProgress>) {
  return one<CandidateStageProgress>(
    db().from("candidate_stage_progress").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single()
  );
}

export async function createGenerationJob(input: {
  candidate_id: string;
  stage_key: AssessmentStageKey;
  job_type: string;
  provider?: string;
  model_name?: string;
  prompt_version?: string;
  input_summary?: string;
}) {
  return one<QuestionGenerationJob>(
    db()
      .from("question_generation_jobs")
      .insert({
        ...input,
        generation_status: "running",
        started_at: new Date().toISOString()
      })
      .select("*")
      .single()
  );
}

export async function updateGenerationJob(jobId: string, patch: Partial<QuestionGenerationJob> & { generation_status?: GenerationStatus }) {
  return one<QuestionGenerationJob>(
    db().from("question_generation_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("job_id", jobId).select("*").single()
  );
}

export async function createQuestion(input: Omit<AssessmentQuestion, "question_id" | "created_at" | "status"> & { status?: string }) {
  return one<AssessmentQuestion>(db().from("questions").insert(input).select("*").single());
}

export async function updateQuestion(questionId: string, patch: Partial<AssessmentQuestion>) {
  return one<AssessmentQuestion>(db().from("questions").update(patch).eq("question_id", questionId).select("*").single());
}

export async function getQuestion(questionId: string) {
  return maybeOne<AssessmentQuestion>(db().from("questions").select("*").eq("question_id", questionId).maybeSingle());
}

export async function listQuestions(candidateId: string, stageKey?: AssessmentStageKey) {
  let query = db().from("questions").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: true });
  if (stageKey) query = query.eq("stage_key", stageKey);
  return many<AssessmentQuestion>(query);
}

export async function createAnswerSession(input: Omit<AnswerSession, "session_id" | "created_at" | "updated_at" | "session_status"> & { session_status?: string }) {
  return one<AnswerSession>(
    db()
      .from("answer_sessions")
      .insert({ ...input, session_status: input.session_status ?? "open" })
      .select("*")
      .single()
  );
}

export async function getAnswerSession(candidateId: string, questionId: string) {
  return maybeOne<AnswerSession>(
    db().from("answer_sessions").select("*").eq("candidate_id", candidateId).eq("question_id", questionId).maybeSingle()
  );
}

export async function updateAnswerSession(sessionId: string, patch: Partial<AnswerSession>) {
  return one<AnswerSession>(
    db().from("answer_sessions").update({ ...patch, updated_at: new Date().toISOString() }).eq("session_id", sessionId).select("*").single()
  );
}

export async function upsertDraft(input: {
  candidate_id: string;
  stage_key: AssessmentStageKey;
  question_id: string;
  draft_text: string;
  ai_usage_note_draft: string;
}) {
  return one<AnswerDraft>(
    db()
      .from("answer_drafts")
      .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: "candidate_id,question_id" })
      .select("*")
      .single()
  );
}

export async function getDraft(candidateId: string, questionId: string) {
  return maybeOne<AnswerDraft>(
    db().from("answer_drafts").select("*").eq("candidate_id", candidateId).eq("question_id", questionId).maybeSingle()
  );
}

export async function listDrafts(candidateId: string) {
  return many<AnswerDraft>(db().from("answer_drafts").select("*").eq("candidate_id", candidateId).order("updated_at", { ascending: true }));
}

export async function getAnswerByClientSubmitId(candidateId: string, questionId: string, clientSubmitId: string) {
  return maybeOne<AssessmentAnswer>(
    db()
      .from("answers")
      .select("*")
      .eq("candidate_id", candidateId)
      .eq("question_id", questionId)
      .eq("client_submit_id", clientSubmitId)
      .maybeSingle()
  );
}

export async function getAnswerForQuestion(candidateId: string, questionId: string) {
  return maybeOne<AssessmentAnswer>(
    db().from("answers").select("*").eq("candidate_id", candidateId).eq("question_id", questionId).order("submitted_at", { ascending: false }).limit(1).maybeSingle()
  );
}

export async function createAnswer(input: Omit<AssessmentAnswer, "answer_id" | "submitted_at" | "status"> & { status?: string }) {
  return one<AssessmentAnswer>(db().from("answers").insert({ ...input, status: input.status ?? "submitted" }).select("*").single());
}

export async function listAnswers(candidateId: string, stageKey?: AssessmentStageKey) {
  let query = db().from("answers").select("*").eq("candidate_id", candidateId).order("submitted_at", { ascending: true });
  if (stageKey) query = query.eq("stage_key", stageKey);
  return many<AssessmentAnswer>(query);
}

export async function addAssessmentTurnScore(input: Partial<TurnScore> & { candidate_id: string; stage_key: AssessmentStageKey; question_id: string; session_id: string }) {
  return one<TurnScore>(db().from("turn_scores").insert(input).select("*").single());
}

export async function getScoreForQuestion(candidateId: string, questionId: string) {
  return maybeOne<TurnScore>(
    db().from("turn_scores").select("*").eq("candidate_id", candidateId).eq("question_id", questionId).order("created_at", { ascending: false }).limit(1).maybeSingle()
  );
}

export async function listAssessmentScores(candidateId: string, stageKey?: AssessmentStageKey) {
  let query = db().from("turn_scores").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: true });
  if (stageKey) query = query.eq("stage_key", stageKey);
  return many<TurnScore>(query);
}

export async function addAssessmentEvent(input: {
  candidate_id: string;
  stage_key?: AssessmentStageKey;
  question_id?: string | null;
  session_id?: string | null;
  event_type: string;
  event_source?: string;
  event_payload?: Record<string, unknown>;
  raw_content?: string;
  ai_summary?: string;
  risk_tags?: string[];
}) {
  return one(
    db()
      .from("event_logs")
      .insert({
        candidate_id: input.candidate_id,
        stage_key: input.stage_key,
        question_id: input.question_id,
        session_id: input.session_id,
        event_type: input.event_type,
        event_source: input.event_source ?? "system",
        event_payload: input.event_payload ?? {},
        raw_content: input.raw_content ?? JSON.stringify(input.event_payload ?? {}),
        ai_summary: input.ai_summary,
        risk_tags: input.risk_tags ?? []
      })
      .select("*")
      .single()
  );
}

export async function addChatMessage(input: Omit<ChatMessage, "message_id" | "created_at">) {
  return one<ChatMessage>(db().from("chat_messages").insert(input).select("*").single());
}

export async function listChatMessages(candidateId: string, questionId?: string | null) {
  let query = db().from("chat_messages").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: true });
  if (questionId) query = query.eq("question_id", questionId);
  return many<ChatMessage>(query);
}

export async function upsertStageEvaluation(input: {
  candidate_id: string;
  stage_key: AssessmentStageKey;
  evaluator_role: string;
  score?: number | null;
  evaluation_text?: string | null;
  verification_points?: unknown;
}) {
  return one(
    db()
      .from("stage_evaluations")
      .insert({ ...input, verification_points: input.verification_points ?? [] })
      .select("*")
      .single()
  );
}

export async function listStageEvaluations(candidateId: string) {
  return many(db().from("stage_evaluations").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: true }));
}

export async function addFinalReviewReport(input: Record<string, unknown> & { candidate_id: string }) {
  return one(db().from("final_review_reports").insert(input).select("*").single());
}

export async function getLatestFinalReviewReport(candidateId: string) {
  return maybeOne(db().from("final_review_reports").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: false }).limit(1).maybeSingle());
}

export async function addCandidateProfile(input: Record<string, unknown> & { candidate_id: string }) {
  return one(db().from("candidate_profiles").insert(input).select("*").single());
}

export async function getLatestCandidateProfile(candidateId: string) {
  return maybeOne(db().from("candidate_profiles").select("*").eq("candidate_id", candidateId).order("generated_at", { ascending: false }).limit(1).maybeSingle());
}
