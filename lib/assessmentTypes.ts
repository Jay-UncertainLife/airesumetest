import { ModelProvider } from "./types";

export type AssessmentStageKey = "basic" | "ability" | "final";

export type AssessmentState =
  | "INIT"
  | "GENERATING_FIRST_QUESTION"
  | "GENERATING_NEXT_QUESTION"
  | "ANSWERING"
  | "ANSWERING_OVERTIME"
  | "SUBMITTING_ANSWER"
  | "SCORING"
  | "WAITING_NEXT_ACTION"
  | "BASIC_STAGE_COMPLETED"
  | "ABILITY_STAGE_COMPLETED"
  | "FINAL_EVALUATION_COMPLETED"
  | "COMPLETED"
  | "GENERATION_FAILED"
  | "SCORE_FAILED";

export type GenerationStatus = "pending" | "running" | "success" | "failed" | "retrying";

export type CandidateStageProgress = {
  id: string;
  candidate_id: string;
  stage_key: AssessmentStageKey;
  current_state: AssessmentState;
  current_dimension?: string | null;
  current_question_id?: string | null;
  current_question_index?: number | null;
  question_started_at?: string | null;
  target_duration_seconds?: number | null;
  dimension_progress_json?: Record<string, unknown> | null;
  timeout_level?: string | null;
  active_question_id?: string | null;
  generation_status?: GenerationStatus | null;
  score_status?: string | null;
  last_error?: string | null;
  locked_until?: string | null;
  updated_at: string;
  created_at: string;
};

export type AssessmentQuestion = {
  question_id: string;
  candidate_id: string;
  stage_key: AssessmentStageKey;
  dimension_key?: string | null;
  question_type: "initial" | "followup" | "constraint_change" | "final_delivery";
  question_text: string;
  question_context_json?: Record<string, unknown> | null;
  target_duration_seconds?: number | null;
  prompt_version?: string | null;
  model_name?: string | null;
  generation_job_id?: string | null;
  created_at: string;
  status: string;
};

export type AnswerSession = {
  session_id: string;
  candidate_id: string;
  stage_key: AssessmentStageKey;
  question_id: string;
  session_status: string;
  question_text_snapshot?: string | null;
  answer_text_snapshot?: string | null;
  ai_usage_note_snapshot?: string | null;
  score_snapshot_json?: Record<string, unknown> | null;
  rendered_text_snapshot?: string | null;
  image_snapshot_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type AnswerDraft = {
  id: string;
  candidate_id: string;
  stage_key: AssessmentStageKey;
  question_id: string;
  draft_text?: string | null;
  ai_usage_note_draft?: string | null;
  updated_at: string;
};

export type AssessmentAnswer = {
  answer_id: string;
  candidate_id: string;
  stage_key: AssessmentStageKey;
  question_id: string;
  session_id: string;
  answer_text?: string | null;
  ai_usage_note?: string | null;
  target_duration_seconds?: number | null;
  actual_duration_seconds?: number | null;
  time_factor?: number | null;
  timeout_level?: string | null;
  submit_type?: "manual" | "auto_timeout" | null;
  answer_status?: "submitted" | "empty_timeout" | null;
  client_submit_id?: string | null;
  submitted_at: string;
  status: string;
};

export type QuestionGenerationJob = {
  job_id: string;
  candidate_id: string;
  stage_key: AssessmentStageKey;
  question_id?: string | null;
  job_type: string;
  generation_status: GenerationStatus;
  model_name?: string | null;
  provider?: ModelProvider | null;
  prompt_version?: string | null;
  input_summary?: string | null;
  output_text?: string | null;
  retry_count?: number | null;
  last_error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  message_id: string;
  candidate_id: string;
  stage_key?: AssessmentStageKey | null;
  question_id?: string | null;
  session_id?: string | null;
  role: "candidate" | "model";
  content: string;
  model_name?: string | null;
  created_at: string;
};
