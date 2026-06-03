create extension if not exists "pgcrypto";

create table if not exists candidate_stage_progress (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  stage_key text not null check (stage_key in ('basic', 'ability', 'final')),
  current_state text not null default 'INIT',
  current_dimension text,
  current_question_id uuid,
  current_question_index int default 0,
  question_started_at timestamptz,
  target_duration_seconds int,
  dimension_progress_json jsonb default '{}'::jsonb,
  timeout_level text,
  active_question_id uuid,
  generation_status text default 'pending',
  score_status text,
  last_error text,
  locked_until timestamptz,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(candidate_id, stage_key)
);

create table if not exists question_generation_jobs (
  job_id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  stage_key text not null,
  question_id uuid,
  job_type text not null,
  generation_status text not null default 'pending',
  model_name text,
  provider text,
  prompt_version text,
  input_summary text,
  output_text text,
  retry_count int default 0,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists questions (
  question_id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  stage_key text not null,
  dimension_key text,
  question_type text not null,
  question_text text not null,
  question_context_json jsonb default '{}'::jsonb,
  target_duration_seconds int,
  prompt_version text,
  model_name text,
  generation_job_id uuid references question_generation_jobs(job_id) on delete set null,
  created_at timestamptz default now(),
  status text default 'active'
);

create table if not exists answer_sessions (
  session_id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  stage_key text not null,
  question_id uuid references questions(question_id) on delete cascade,
  session_status text default 'open',
  question_text_snapshot text,
  answer_text_snapshot text,
  ai_usage_note_snapshot text,
  score_snapshot_json jsonb,
  rendered_text_snapshot text,
  image_snapshot_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(candidate_id, question_id)
);

create table if not exists answer_drafts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  stage_key text not null,
  question_id uuid references questions(question_id) on delete cascade,
  draft_text text,
  ai_usage_note_draft text,
  updated_at timestamptz default now(),
  unique(candidate_id, question_id)
);

create table if not exists answers (
  answer_id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  stage_key text not null,
  question_id uuid references questions(question_id) on delete cascade,
  session_id uuid references answer_sessions(session_id) on delete cascade,
  answer_text text,
  ai_usage_note text,
  target_duration_seconds int,
  actual_duration_seconds int,
  time_factor numeric,
  timeout_level text,
  submit_type text,
  answer_status text,
  client_submit_id text,
  submitted_at timestamptz default now(),
  status text default 'submitted',
  unique(candidate_id, question_id, client_submit_id)
);

create table if not exists chat_messages (
  message_id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  stage_key text,
  question_id uuid references questions(question_id) on delete set null,
  session_id uuid references answer_sessions(session_id) on delete set null,
  role text not null,
  content text not null,
  model_name text,
  created_at timestamptz default now()
);

create table if not exists stage_evaluations (
  evaluation_id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  stage_key text not null,
  evaluator_role text not null,
  score numeric,
  evaluation_text text,
  verification_points jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  original_profile_json jsonb,
  updated_profile_json jsonb,
  profile_comparison_json jsonb,
  profile_summary text,
  generated_at timestamptz default now()
);

create table if not exists final_review_reports (
  report_id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  final_profile_json jsonb,
  basic_stage_summary text,
  ability_stage_summary text,
  final_evaluation_summary text,
  supervisor_scores_json jsonb,
  overall_score numeric,
  overall_comment text,
  pass_decision text,
  probation_assessment_suggestions text,
  verification_focus_points jsonb,
  risk_points jsonb,
  report_text text,
  created_at timestamptz default now()
);

alter table turn_scores add column if not exists stage_key text;
alter table turn_scores add column if not exists question_id uuid;
alter table turn_scores add column if not exists session_id uuid;
alter table turn_scores add column if not exists dimension_key text;
alter table turn_scores add column if not exists content_score numeric;
alter table turn_scores add column if not exists final_score numeric;
alter table turn_scores add column if not exists score_status text;
alter table turn_scores add column if not exists timeout_level text;
alter table turn_scores add column if not exists evidence_summary jsonb;
alter table turn_scores add column if not exists risk_flags jsonb;
alter table turn_scores add column if not exists need_follow_up boolean;
alter table turn_scores add column if not exists next_action text;
alter table turn_scores add column if not exists model_name text;
alter table turn_scores add column if not exists prompt_version text;

alter table event_logs add column if not exists stage_key text;
alter table event_logs add column if not exists question_id uuid;
alter table event_logs add column if not exists session_id uuid;
alter table event_logs add column if not exists event_source text;
alter table event_logs add column if not exists event_payload jsonb;

create index if not exists idx_candidate_stage_progress_candidate on candidate_stage_progress(candidate_id);
create index if not exists idx_questions_candidate_stage on questions(candidate_id, stage_key);
create index if not exists idx_answers_candidate_question on answers(candidate_id, question_id);
create index if not exists idx_chat_messages_candidate_question on chat_messages(candidate_id, question_id);
