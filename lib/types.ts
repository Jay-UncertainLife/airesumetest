export type Recommendation = "通过" | "继续观察" | "Cut";
export type CandidateStatus = "created" | "in_progress" | "submitted" | "evaluated" | "reviewed";
export type StageName = "面试关卡准备" | "基础关卡" | "能力关卡";
export type StageStatus = "not_started" | "in_progress" | "completed";
export type ModelProvider = "deepseek" | "openai";
export type DifficultyLevel = "L1" | "L2" | "L3" | "L4" | "L5";
export type ParticipationLevel = "P0" | "P1" | "P2" | "P3";

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

export type Candidate = {
  id: string;
  name: string;
  target_role?: string;
  target_difficulty?: DifficultyLevel;
  resume_text?: string;
  resume_file_name?: string;
  persona_profile?: PersonaProfile;
  selected_model?: ModelProvider;
  ability_plan?: AbilityPlan;
  status: CandidateStatus;
  final_recommendation?: Recommendation;
  final_solution?: string;
  ai_usage_note?: string;
  created_at: string;
};

export type Stage = {
  id: string;
  candidate_id: string;
  name: StageName;
  status: StageStatus;
  target_duration_seconds?: number;
  started_at?: string;
  completed_at?: string;
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
  human_review_result?: Recommendation;
  human_review_comment?: string;
  created_at: string;
};

export type PersonaProfile = {
  summary: string;
  strengths: string[];
  risks: string[];
  interview_focus: string[];
  source_model: ModelProvider | "mock";
};

export type AbilityPlan = {
  role: string;
  generated_by: ModelProvider | "mock";
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
  message_id: string;
  stage_id: string;
  elapsed_seconds?: number;
  time_coefficient?: number;
  scores: Record<string, number>;
  average_score: number;
  recommendation: Recommendation;
  risk_tags: string[];
  reason_summary: string;
  next_question_standard: string;
  model_provider: ModelProvider | "mock";
  created_at: string;
};

export type Store = {
  candidates: Candidate[];
  agents: Agent[];
  stages: Stage[];
  messages: Message[];
  workspaceMessages: WorkspaceMessage[];
  eventLogs: EventLog[];
  evaluations: Evaluation[];
  turnScores: TurnScore[];
  jobRoles: JobRole[];
};
