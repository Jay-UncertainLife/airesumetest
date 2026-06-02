create extension if not exists "pgcrypto";

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_role text,
  target_difficulty text,
  status text default 'created',
  resume_text text,
  resume_file_name text,
  persona_profile jsonb,
  candidate_token text unique,
  invite_url text,
  selected_model text default 'deepseek',
  ability_plan jsonb,
  final_recommendation text,
  final_solution text,
  ai_usage_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists interviewer_evaluations (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  round_no int,
  interviewer_name text,
  interview_stage text,
  evaluation_text text,
  recommendation text,
  created_at timestamptz default now()
);

create table if not exists stages (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  name text,
  status text,
  target_duration_seconds int,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  stage_id uuid references stages(id) on delete cascade,
  role text,
  ai_role text,
  model_provider text,
  agent_id uuid,
  content text,
  created_at timestamptz default now()
);

create table if not exists workspace_messages (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  stage_id uuid references stages(id) on delete cascade,
  role text,
  model_provider text,
  content text,
  created_at timestamptz default now()
);

create table if not exists event_logs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  stage_id uuid references stages(id) on delete cascade,
  event_type text,
  raw_content text,
  ai_summary text,
  risk_tags jsonb,
  created_at timestamptz default now()
);

create table if not exists turn_scores (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  message_id uuid references messages(id) on delete cascade,
  stage_id uuid references stages(id) on delete cascade,
  elapsed_seconds int,
  time_coefficient numeric,
  scores jsonb,
  average_score numeric,
  recommendation text,
  risk_tags jsonb,
  reason_summary text,
  next_question_standard text,
  model_provider text,
  created_at timestamptz default now()
);

create table if not exists final_evaluations (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  scores jsonb,
  average_score numeric,
  risk_tags jsonb,
  recommendation text,
  reason_summary text,
  evidence_summary jsonb,
  human_review_result text,
  human_review_comment text,
  model_provider text,
  created_at timestamptz default now()
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  name text,
  target_role text,
  agent_role text,
  model_provider text,
  model_name text,
  persona text,
  responsibility text,
  exam_goal text,
  opening_prompt text,
  follow_up_rules text,
  pressure_rules text,
  scoring_rubric text,
  cut_rules text,
  status text default 'enabled',
  created_at timestamptz default now()
);

create table if not exists job_roles (
  id uuid primary key default gen_random_uuid(),
  name text,
  difficulty text,
  description text,
  enabled boolean default true,
  ability_dimensions jsonb,
  basic_participation jsonb,
  ability_participation jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into job_roles (name, difficulty, description, enabled, ability_dimensions, basic_participation, ability_participation)
select
  'AI 产品经理',
  'L2',
  '面向 AI 产品经理岗位的小闭环考核，初始化难度为 L2。',
  true,
  '[
    {"key":"ai_scene_identification","code":"P01","name":"AI 场景识别能力","weight":12,"target_level":"L2","description":"能不能判断哪个业务节点适合 AI 介入","observation":"是否能说清 AI 介入点"},
    {"key":"user_scene_understanding","code":"P02","name":"用户场景理解能力","weight":13,"target_level":"L2","description":"能不能理解真实用户行为和使用动机","observation":"是否只站在业务方角度"},
    {"key":"demand_clarification","code":"P03","name":"需求澄清能力","weight":12,"target_level":"L2","description":"能不能提出关键问题，收敛需求范围","observation":"是否问到目标、用户、指标、约束"},
    {"key":"mvp_tradeoff","code":"P04","name":"MVP 取舍能力","weight":16,"target_level":"L2","description":"能不能在有限资源下保留最小验证闭环","observation":"是否能明确砍什么"},
    {"key":"flow_design","code":"P05","name":"流程设计能力","weight":13,"target_level":"L2","description":"能不能设计任务流、状态流、审核流、反馈流","observation":"是否有完整闭环"},
    {"key":"metric_design","code":"P06","name":"指标设计能力","weight":10,"target_level":"L2","description":"能不能定义成功标准和关键指标","observation":"是否有可验证指标"},
    {"key":"feedback_loop","code":"P07","name":"反馈闭环设计能力","weight":10,"target_level":"L2","description":"能不能让用户行为、业务结果、AI 输出形成闭环","observation":"是否能持续优化"},
    {"key":"rule_mechanism","code":"P08","name":"规则机制设计能力","weight":14,"target_level":"L2","description":"能不能把抽象原则变成系统规则","observation":"是否有明确触发、限制和例外"}
  ]'::jsonb,
  '[
    {"ai_role":"AI 产品负责人考核官","level":"P3","reason":"主导基础关卡，判断业务目标和产品闭环。"},
    {"ai_role":"产品闭环评委","level":"P2","reason":"辅助检查用户场景、MVP 取舍和反馈闭环。"},
    {"ai_role":"压力与落地评委","level":"P1","reason":"轻量提醒资源边界。"},
    {"ai_role":"证据链评委","level":"P3","reason":"记录全过程并做可复核评分。"}
  ]'::jsonb,
  '[
    {"ai_role":"AI 产品负责人考核官","level":"P3","reason":"持续追问业务目标、价值判断和优先级。"},
    {"ai_role":"产品闭环评委","level":"P3","reason":"重点检查场景、流程、MVP 取舍和反馈闭环。"},
    {"ai_role":"压力与落地评委","level":"P2","reason":"加入时间、人力、技术限制，观察应变。"},
    {"ai_role":"证据链评委","level":"P3","reason":"按 P01-P08 能力维度评分并生成复核证据。"}
  ]'::jsonb
where not exists (select 1 from job_roles where name = 'AI 产品经理');

insert into agents (name, target_role, agent_role, model_provider, model_name, persona, responsibility, exam_goal, opening_prompt, follow_up_rules, pressure_rules, scoring_rubric, cut_rules, status)
select * from (values
  ('AI 产品负责人考核官','AI 产品经理','lead_examiner','deepseek','deepseek-chat','直接、结构化、强闭环意识','主持关卡推进，综合能力维度与逐轮得分决定继续追问、进入下一关或 Cut。','评估候选人是否具备 AI 产品经理的场景理解、MVP 收敛和业务判断能力。','请候选人在限定时间内设计一个面向招聘考核场景的 AI 产品 MVP。','围绕用户、场景、闭环、取舍、AI 原生性追问。','追加时间、人力、KPI、误判和证据约束。','按 AI 产品经理动态能力组合逐轮评分。','如果候选人连续无法说明核心闭环、取舍失控或方案不可落地，建议 Cut。','enabled'),
  ('产品闭环评委','AI 产品经理','product_judge','deepseek','deepseek-chat','冷静、追根究底、关注 MVP 边界','评估产品定位、用户场景、最小闭环和功能取舍。','识别候选人是否能把 AI 产品从想法压缩成可演示闭环。','聚焦 AI 产品 MVP 的闭环完整度。','追问入口、核心动作、输出物、审核价值和砍掉项。','要求候选人用更少页面、更少接口完成同样闭环。','产品闭环、优先级判断、AI 原生程度。','若持续大而全或无法定义最小闭环，标记高风险。','enabled'),
  ('压力与落地评委','AI 产品经理','pressure_judge','deepseek','deepseek-chat','强压、现实、资源约束导向','制造时间、人力、技术、老板改需求等约束，观察候选人应变。','判断候选人在两周、两人、现成 API 条件下是否能落地。','把方案压到两周可演示。','追问技术边界、人力排期、验收标准和风险预案。','持续加入资源限制、误判风险、数据留痕要求。','约束下应变、风险识别、落地能力。','若无法取舍或无法说明落地路径，建议继续观察或 Cut。','enabled'),
  ('证据链评委','AI 产品经理','evidence_judge','openai','gpt-4o-mini','审慎、证据导向、关注可复核性','评估过程记录、模型切换留痕、AI 使用说明和人工复核依据。','判断候选人是否理解 AI 考核产品的信任与可解释问题。','关注过程证据与审核可信度。','追问如何留痕、如何回放、如何防止纯 AI 代答、如何处理误判。','取消录屏或压缩日志后，要求候选人重建证据链。','证据链、风险识别、AI 使用边界。','若完全忽略证据记录和人工复核，标记高风险。','enabled')
) as seed(name, target_role, agent_role, model_provider, model_name, persona, responsibility, exam_goal, opening_prompt, follow_up_rules, pressure_rules, scoring_rubric, cut_rules, status)
where not exists (select 1 from agents);
