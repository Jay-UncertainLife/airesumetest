export type Recommendation = "通过" | "继续观察" | "Cut";
export type CandidateStatus =
  | "created"
  | "profiled"
  | "invited"
  | "in_progress"
  | "assessment_started"
  | "submitted"
  | "evaluated"
  | "reviewed"
  | "assessment_completed";
export type StageName = "面试关卡准备" | "基础关卡" | "能力关卡";
export type StageStatus = "not_started" | "in_progress" | "completed";
export type ModelProvider = "deepseek" | "openai";
export type DifficultyLevel = "L1" | "L2" | "L3" | "L4" | "L5";
export type ParticipationLevel = "P0" | "P1" | "P2" | "P3";

export type PromptName =
  | "persona-profile.deepseek.md"
  | "basic_stage/generate_first_question.md"
  | "basic_stage/generate_followup_question.md"
  | "basic_stage/score_answer.md"
  | "ability_stage/generate_first_question.md"
  | "ability_stage/generate_followup_question.md"
  | "ability_stage/score_answer.md"
  | "final_stage/generate_review_report.md"
  | "basic-stage-opening.deepseek.md"
  | "ability-stage-opening.deepseek.md"
  | "follow-up.deepseek.md"
  | "follow-up.openai.md"
  | "turn-score.deepseek.md"
  | "turn-score.openai.md"
  | "workspace-reply.deepseek.md"
  | "workspace-reply.openai.md"
  | "final-evaluation.deepseek.md"
  | "final-evaluation.openai.md"
  | "ability-plan.deepseek.md"
  | "ability-plan.openai.md";

export type ModelCallResult = {
  provider: ModelProvider;
  model: string;
  content: string;
};

export type Agent = {
  id: string;
  name: string;
  target_role: string;
  agent_role: "lead_examiner" | "product_judge" | "pressure_judge" | "evidence_judge" | "custom";
  model_provider: ModelProvider;
  model_name: string;
  persona: string;
  responsibility: string;
  exam_goal: string;
  opening_prompt: string;
  follow_up_rules: string;
  pressure_rules: string;
  scoring_rubric: string;
  cut_rules: string;
  status: "enabled" | "disabled";
  created_at: string;
};

export type InterviewerEvaluation = {
  id?: string;
  candidate_id?: string;
  round_no: number;
  interviewer_name: string;
  interview_stage: string;
  evaluation_text: string;
  recommendation: string;
  created_at?: string;
};

export type PersonaProfile = {
  summary: string;
  strengths: string[];
  risks: string[];
  interview_focus: string[];
  resume_signals: string[];
  interviewer_signals: string[];
  role_fit: string;
  source_model: ModelProvider;
};

export type Candidate = {
  id: string;
  name: string;
  target_role?: string;
  target_difficulty?: DifficultyLevel;
  status: CandidateStatus;
  resume_text?: string;
  resume_file_name?: string;
  interviewer_evaluations?: InterviewerEvaluation[];
  persona_profile?: PersonaProfile;
  candidate_token?: string;
  invite_url?: string;
  selected_model?: ModelProvider;
  ability_plan?: AbilityPlan;
  final_recommendation?: Recommendation;
  final_solution?: string;
  ai_usage_note?: string;
  created_at: string;
  updated_at?: string;
};

export type CandidateInvite = {
  candidate_id: string;
  name: string;
  target_role?: string;
  target_difficulty?: DifficultyLevel;
  status: CandidateStatus;
  whether_ready: boolean;
};

export type Stage = {
  id: string;
  candidate_id: string;
  name: StageName;
  status: StageStatus;
  target_duration_seconds?: number;
  started_at?: string;
  completed_at?: string;
  created_at?: string;
};

export type Message = {
  id: string;
  candidate_id: string;
  stage_id: string;
  role: "ai" | "candidate";
  ai_role?: "examiner" | "judge";
  model_provider?: ModelProvider;
  agent_id?: string;
  content: string;
  created_at: string;
};

export type WorkspaceMessage = {
  id: string;
  candidate_id: string;
  stage_id?: string;
  role: "candidate" | "model";
  model_provider: ModelProvider;
  content: string;
  created_at: string;
};

export type EventLog = {
  id: string;
  candidate_id: string;
  stage_id?: string;
  event_type: string;
  raw_content: string;
  ai_summary?: string;
  risk_tags?: string[];
  created_at: string;
};

export type Evaluation = {
  id: string;
  candidate_id: string;
  scores: Record<string, number>;
  average_score: number;
  risk_tags: string[];
  recommendation: Recommendation;
  reason_summary: string;
  evidence_summary: string[];
  reviewer_notes?: string;
  human_review_result?: Recommendation;
  human_review_comment?: string;
  model_provider: ModelProvider;
  created_at: string;
};

export type AbilityPlan = {
  role: string;
  generated_by: ModelProvider;
  dimensions: AbilityDimension[];
  agent_participation: AgentParticipation[];
  question_strategy: string[];
};

export type AbilityDimension = {
  key: string;
  code?: string;
  name: string;
  weight: number;
  target_level?: DifficultyLevel;
  description: string;
  observation?: string;
};

export type AgentParticipation = {
  agent_role: Agent["agent_role"];
  agent_name: string;
  weight: number;
  participation_level?: ParticipationLevel;
  responsibility: string;
  reason?: string;
};

export type JobRole = {
  id: string;
  name: string;
  difficulty: DifficultyLevel;
  description: string;
  enabled: boolean;
  ability_dimensions: AbilityDimension[];
  basic_participation: RoleParticipation[];
  ability_participation: RoleParticipation[];
  created_at: string;
  updated_at: string;
};

export type RoleParticipation = {
  ai_role: string;
  level: ParticipationLevel;
  reason: string;
};

export type TurnScore = {
  id: string;
  candidate_id: string;
  message_id?: string;
  stage_id?: string;
  stage_key?: "basic" | "ability" | "final";
  question_id?: string;
  session_id?: string;
  dimension_key?: string;
  content_score?: number;
  final_score?: number;
  score_status?: string;
  timeout_level?: string;
  evidence_summary?: string[];
  risk_flags?: string[];
  need_follow_up?: boolean;
  next_action?: string;
  model_name?: string;
  prompt_version?: string;
  elapsed_seconds?: number;
  time_coefficient?: number;
  scores: Record<string, number>;
  average_score: number;
  recommendation: Recommendation;
  risk_tags: string[];
  reason_summary: string;
  next_question_standard: string;
  model_provider: ModelProvider;
  created_at: string;
};

