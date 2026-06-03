import { generateFollowUp, generateStageOpening, generateWorkspaceReply, scoreTurn } from "./ai";
import { AssessmentStageKey, AssessmentState } from "./assessmentTypes";
import { calculateTimeCoefficient, basicStageDimensions, stageDurations, timeoutLevel } from "./stages";
import { ABILITY_STAGE, BASIC_STAGE, stageNameFromKey } from "./stageNames";
import { AbilityDimension, Candidate, ModelProvider, Stage, TurnScore } from "./types";
import { listAgents } from "./repositories/agents";
import { updateCandidate } from "./repositories/candidates";
import {
  addAssessmentEvent,
  addAssessmentTurnScore,
  addChatMessage,
  addCandidateProfile,
  addFinalReviewReport,
  createAnswer,
  createAnswerSession,
  createGenerationJob,
  createQuestion,
  getAnswerByClientSubmitId,
  getAnswerForQuestion,
  getAnswerSession,
  getDraft,
  getLatestCandidateProfile,
  getLatestFinalReviewReport,
  getQuestion,
  getScoreForQuestion,
  listAnswers,
  listAssessmentScores,
  listChatMessages,
  listDrafts,
  listQuestions,
  listStageEvaluations,
  listStageProgress,
  ensureStageProgress,
  updateAnswerSession,
  updateGenerationJob,
  updateQuestion,
  updateStageProgress,
  upsertDraft
} from "./repositories/assessment";

const STAGE_TARGET_SECONDS = {
  basic: stageDurations[BASIC_STAGE],
  ability: stageDurations[ABILITY_STAGE],
  final: 15 * 60
} as const;

export async function initializeAssessment(candidate: Candidate) {
  const progress = await ensureStageProgress({
    candidate_id: candidate.id,
    stage_key: "basic",
    current_state: "INIT",
    target_duration_seconds: STAGE_TARGET_SECONDS.basic
  });
  if (candidate.status !== "assessment_started" && candidate.status !== "assessment_completed") {
    await updateCandidate(candidate.id, { status: "assessment_started" });
  }
  await addAssessmentEvent({
    candidate_id: candidate.id,
    stage_key: "basic",
    event_type: "assessment_started",
    event_source: "candidate",
    event_payload: { state: progress.current_state }
  });
  return progress;
}

export async function getAssessmentCurrent(candidate: Candidate) {
  await ensureStageProgress({
    candidate_id: candidate.id,
    stage_key: "basic",
    current_state: "INIT",
    target_duration_seconds: STAGE_TARGET_SECONDS.basic
  });
  const progressRows = await listStageProgress(candidate.id);
  const basic = progressRows.find((row) => row.stage_key === "basic");
  const ability = progressRows.find((row) => row.stage_key === "ability");
  const final = progressRows.find((row) => row.stage_key === "final");
  const activeProgress =
    basic && basic.current_state !== "BASIC_STAGE_COMPLETED"
      ? basic
      : ability && ability.current_state !== "ABILITY_STAGE_COMPLETED"
        ? ability
        : final && final.current_state !== "FINAL_EVALUATION_COMPLETED" && final.current_state !== "COMPLETED"
          ? final
          : final ?? ability ?? basic;

  let activeQuestion = activeProgress?.active_question_id ? await getQuestion(activeProgress.active_question_id) : null;
  if (!activeQuestion && activeProgress?.current_question_id && ["ANSWERING", "ANSWERING_OVERTIME", "SUBMITTING_ANSWER", "SCORING", "WAITING_NEXT_ACTION", "MANUAL_REVIEW_REQUIRED"].includes(activeProgress.current_state)) {
    activeQuestion = await getQuestion(activeProgress.current_question_id);
  }
  if (!activeQuestion && activeProgress && ["ANSWERING", "ANSWERING_OVERTIME"].includes(activeProgress.current_state)) {
    const stageQuestions = await listQuestions(candidate.id, activeProgress.stage_key);
    activeQuestion = [...stageQuestions].reverse().find((question) => question.status === "active") ?? null;
    if (activeQuestion && !activeProgress.active_question_id) {
      await updateStageProgress(activeProgress.id, {
        active_question_id: activeQuestion.question_id,
        current_question_id: activeQuestion.question_id
      });
    }
  }
  const session = activeQuestion ? await getAnswerSession(candidate.id, activeQuestion.question_id) : null;
  const draft = activeQuestion ? await getDraft(candidate.id, activeQuestion.question_id) : null;
  const answer = activeQuestion ? await getAnswerForQuestion(candidate.id, activeQuestion.question_id) : null;
  const latestScore = activeQuestion ? await getScoreForQuestion(candidate.id, activeQuestion.question_id) : null;
  const [questions, answers, scores, chatMessages, drafts, stageEvaluations, finalReport, updatedProfile] = await Promise.all([
    listQuestions(candidate.id),
    listAnswers(candidate.id),
    listAssessmentScores(candidate.id),
    listChatMessages(candidate.id, activeQuestion?.question_id),
    listDrafts(candidate.id),
    listStageEvaluations(candidate.id),
    getLatestFinalReviewReport(candidate.id),
    getLatestCandidateProfile(candidate.id)
  ]);

  const timing = buildTiming(activeProgress);
  const button = buildButton(activeProgress, activeQuestion, answer, latestScore);
  return {
    candidate,
    progressRows,
    activeProgress,
    stage_key: activeProgress?.stage_key ?? "basic",
    stage_name: activeProgress ? stageNameFromKey(activeProgress.stage_key) : BASIC_STAGE,
    current_question: activeQuestion,
    session,
    draft,
    answer,
    latestScore,
    questions,
    answers,
    scores,
    chatMessages,
    drafts,
    stageEvaluations,
    finalReport,
    updatedProfile,
    timing,
    button
  };
}

export async function startFirstQuestion(candidate: Candidate, provider: ModelProvider) {
  const current = await getAssessmentCurrent(candidate);
  const progress = current.activeProgress;
  if (!progress) throw new Error("assessment_progress_not_found");
  if (progress.active_question_id && current.current_question) return getAssessmentCurrent(candidate);
  if (progress.current_state !== "INIT" && progress.current_state !== "GENERATION_FAILED") {
    return getAssessmentCurrent(candidate);
  }
  return generateQuestion(candidate, progress.stage_key, progress, "initial", "GENERATING_FIRST_QUESTION", provider);
}

export async function saveDraft(candidate: Candidate, input: { draft_text: string; ai_usage_note_draft: string }) {
  const current = await getAssessmentCurrent(candidate);
  if (!current.activeProgress?.active_question_id) throw new Error("active_question_not_found");
  const draft = await upsertDraft({
    candidate_id: candidate.id,
    stage_key: current.activeProgress.stage_key,
    question_id: current.activeProgress.active_question_id,
    draft_text: input.draft_text,
    ai_usage_note_draft: input.ai_usage_note_draft
  });
  await addAssessmentEvent({
    candidate_id: candidate.id,
    stage_key: current.activeProgress.stage_key,
    question_id: current.activeProgress.active_question_id,
    session_id: current.session?.session_id,
    event_type: "draft_saved",
    event_payload: { length: input.draft_text.length }
  });
  return draft;
}

export async function submitAnswer(candidate: Candidate, input: {
  answer_text: string;
  ai_usage_note: string;
  client_submit_id: string;
  submit_type?: "manual" | "auto_timeout";
}) {
  const current = await getAssessmentCurrent(candidate);
  const progress = current.activeProgress;
  const question = current.current_question;
  if (!progress || !question) throw new Error("active_question_not_found");
  const existing = await getAnswerByClientSubmitId(candidate.id, question.question_id, input.client_submit_id);
  if (existing) return getAssessmentCurrent(candidate);
  const session = current.session ?? await createAnswerSession({
    candidate_id: candidate.id,
    stage_key: progress.stage_key,
    question_id: question.question_id,
    question_text_snapshot: question.question_text
  });
  const elapsed = elapsedSeconds(progress.question_started_at);
  const target = question.target_duration_seconds ?? progress.target_duration_seconds ?? STAGE_TARGET_SECONDS[progress.stage_key];
  const factor = calculateTimeCoefficient(elapsed, target);
  const level = timeoutLevel(elapsed, target);
  await updateStageProgress(progress.id, {
    current_state: "SUBMITTING_ANSWER",
    timeout_level: level
  });
  const answerText = input.answer_text.trim();
  await createAnswer({
    candidate_id: candidate.id,
    stage_key: progress.stage_key,
    question_id: question.question_id,
    session_id: session.session_id,
    answer_text: answerText,
    ai_usage_note: input.ai_usage_note.trim(),
    target_duration_seconds: target,
    actual_duration_seconds: elapsed,
    time_factor: factor,
    timeout_level: level,
    submit_type: input.submit_type ?? "manual",
    answer_status: answerText ? "submitted" : "empty_timeout",
    client_submit_id: input.client_submit_id
  });
  await updateAnswerSession(session.session_id, {
    session_status: "submitted",
    answer_text_snapshot: answerText,
    ai_usage_note_snapshot: input.ai_usage_note.trim(),
    rendered_text_snapshot: renderSessionText(question.question_text, answerText, input.ai_usage_note.trim())
  });
  await updateQuestion(question.question_id, { status: "submitted" });
  await updateStageProgress(progress.id, { current_state: "SCORING", score_status: "score_pending" });
  await addAssessmentEvent({
    candidate_id: candidate.id,
    stage_key: progress.stage_key,
    question_id: question.question_id,
    session_id: session.session_id,
    event_type: input.submit_type === "auto_timeout" ? "auto_timeout_submit" : "answer_submitted",
    event_source: "candidate",
    event_payload: { elapsed, factor, level, empty: !answerText }
  });
  return getAssessmentCurrent(candidate);
}

export async function scoreCurrentAnswer(candidate: Candidate, provider: ModelProvider) {
  const current = await getAssessmentCurrent(candidate);
  const progress = current.activeProgress;
  const question = current.current_question;
  if (!progress || !question) throw new Error("active_question_not_found");
  const session = current.session ?? await getAnswerSession(candidate.id, question.question_id);
  const answer = current.answer ?? await getAnswerForQuestion(candidate.id, question.question_id);
  if (!session || !answer) throw new Error("answer_not_submitted");
  const existingScore = await getScoreForQuestion(candidate.id, question.question_id);
  if (existingScore && existingScore.score_status !== "score_failed") return getAssessmentCurrent(candidate);
  await updateStageProgress(progress.id, { current_state: "SCORING", score_status: "score_running" });
  await addAssessmentEvent({
    candidate_id: candidate.id,
    stage_key: progress.stage_key,
    question_id: question.question_id,
    session_id: session.session_id,
    event_type: "scoring_started",
    event_payload: { provider }
  });

  try {
    const dimensions = dimensionsForStage(candidate, progress.stage_key);
    const stage = fakeStage(progress.stage_key);
    const scoreDraft = await scoreTurn({
      provider,
      candidateAnswer: answer.answer_text ?? "",
      aiUsageNote: answer.ai_usage_note ?? "",
      currentStage: stage,
      abilityPlan: { role: candidate.target_role ?? "AI 产品经理", generated_by: provider, dimensions, agent_participation: [], question_strategy: [] },
      messageId: question.question_id,
      candidateId: candidate.id,
      elapsedSeconds: answer.actual_duration_seconds ?? 0,
      timeCoefficient: Number(answer.time_factor ?? 1)
    });
    const ruleDecision = decideTestScore(answer.answer_text ?? "", Number(progress.current_question_index ?? 1));
    const contentScore = ruleDecision.contentScore;
    const finalScore = ruleDecision.finalScore;
    const scoreStatus = ruleDecision.scoreStatus;
    const needsManualReview = ruleDecision.nextAction === "manual_review";
    const needsFollowUp = ruleDecision.nextAction === "follow_up";
    const modelReason = scoreDraft.reason_summary ? `模型摘要：${scoreDraft.reason_summary}` : "";
    const reasonSummary = [ruleDecision.reason, modelReason].filter(Boolean).join("\n");
    const savedScore = await addAssessmentTurnScore({
      candidate_id: candidate.id,
      stage_key: progress.stage_key,
      question_id: question.question_id,
      session_id: session.session_id,
      dimension_key: question.dimension_key ?? dimensions[0]?.key,
      content_score: contentScore,
      final_score: finalScore,
      score_status: scoreStatus,
      timeout_level: answer.timeout_level ?? undefined,
      elapsed_seconds: answer.actual_duration_seconds ?? undefined,
      time_coefficient: answer.time_factor ?? undefined,
      scores: scoreDraft.scores,
      average_score: finalScore,
      recommendation: scoreDraft.recommendation,
      risk_tags: scoreDraft.risk_tags,
      risk_flags: scoreDraft.risk_tags,
      reason_summary: reasonSummary,
      evidence_summary: [ruleDecision.reason, scoreDraft.reason_summary].filter(Boolean),
      need_follow_up: needsFollowUp,
      next_action: needsManualReview ? "manual_review" : needsFollowUp ? "follow_up" : progress.stage_key === "basic" ? "ability_stage" : "final_stage",
      next_question_standard: scoreDraft.next_question_standard,
      model_provider: provider,
      model_name: provider === "openai" ? process.env.OPENAI_MODEL ?? "gpt-4o-mini" : process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
      prompt_version: `${progress.stage_key}_stage/score_answer`
    });
    await updateAnswerSession(session.session_id, {
      session_status: "scored",
      score_snapshot_json: savedScore as unknown as Record<string, unknown>
    });
    await updateQuestion(question.question_id, { status: "scored" });
    const scoredCount = (await listAssessmentScores(candidate.id, progress.stage_key)).length;
    const nextState: AssessmentState = needsManualReview
      ? "MANUAL_REVIEW_REQUIRED"
      : needsFollowUp
        ? "WAITING_NEXT_ACTION"
        : progress.stage_key === "basic"
        ? "BASIC_STAGE_COMPLETED"
        : progress.stage_key === "ability"
          ? "ABILITY_STAGE_COMPLETED"
          : "FINAL_EVALUATION_COMPLETED";
    await updateStageProgress(progress.id, {
      current_state: nextState,
      active_question_id: needsManualReview ? question.question_id : null,
      current_question_id: question.question_id,
      score_status: scoreStatus,
      dimension_progress_json: {
        ...(progress.dimension_progress_json ?? {}),
        [question.dimension_key ?? `q${scoredCount}`]: { finalScore, scoreStatus, question_id: question.question_id }
      }
    });
    await addAssessmentEvent({
      candidate_id: candidate.id,
      stage_key: progress.stage_key,
      question_id: question.question_id,
      session_id: session.session_id,
      event_type: needsManualReview ? "manual_review_required" : "scoring_success",
      event_payload: { finalScore, scoreStatus, scoredCount, nextAction: ruleDecision.nextAction, answerLength: ruleDecision.answerLength },
      ai_summary: reasonSummary,
      risk_tags: scoreDraft.risk_tags
    });
    if (!needsManualReview && !needsFollowUp && progress.stage_key === "basic") {
      const abilityProgress = await ensureStageProgress({ candidate_id: candidate.id, stage_key: "ability", current_state: "INIT", target_duration_seconds: STAGE_TARGET_SECONDS.ability });
      await addAssessmentEvent({
        candidate_id: candidate.id,
        stage_key: "ability",
        event_type: "stage_entered",
        event_source: "system",
        event_payload: { from: "basic", previous_score: finalScore }
      });
      return generateQuestion(candidate, "ability", abilityProgress, "initial", "GENERATING_FIRST_QUESTION", provider);
    }
    if (!needsManualReview && !needsFollowUp && progress.stage_key === "ability") {
      const finalProgress = await ensureStageProgress({ candidate_id: candidate.id, stage_key: "final", current_state: "INIT", target_duration_seconds: STAGE_TARGET_SECONDS.final });
      await updateStageProgress(finalProgress.id, {
        current_state: "INIT",
        score_status: "score_pending",
        dimension_progress_json: { synced_from_stage: "ability", synced_answer_id: answer.answer_id }
      });
      await updateCandidate(candidate.id, {
        final_solution: answer.answer_text ?? "",
        status: "assessment_started"
      });
      await addAssessmentEvent({
        candidate_id: candidate.id,
        stage_key: "final",
        event_type: "stage_entered",
        event_source: "system",
        event_payload: { from: "ability", previous_score: finalScore, synced_answer_id: answer.answer_id }
      });
    }
    return getAssessmentCurrent(candidate);
  } catch (error) {
    await updateStageProgress(progress.id, {
      current_state: "SCORE_FAILED",
      score_status: "score_failed",
      last_error: error instanceof Error ? error.message : String(error)
    });
    await addAssessmentEvent({
      candidate_id: candidate.id,
      stage_key: progress.stage_key,
      question_id: question.question_id,
      session_id: session.session_id,
      event_type: "scoring_failed",
      event_payload: { error: error instanceof Error ? error.message : String(error) }
    });
    throw error;
  }
}

export async function nextQuestion(candidate: Candidate, provider: ModelProvider) {
  const current = await getAssessmentCurrent(candidate);
  const progress = current.activeProgress;
  if (!progress) throw new Error("assessment_progress_not_found");
  if (progress.current_state === "BASIC_STAGE_COMPLETED") {
    await ensureStageProgress({ candidate_id: candidate.id, stage_key: "ability", current_state: "INIT", target_duration_seconds: STAGE_TARGET_SECONDS.ability });
    return getAssessmentCurrent(candidate);
  }
  if (progress.current_state === "ABILITY_STAGE_COMPLETED") {
    await ensureStageProgress({ candidate_id: candidate.id, stage_key: "final", current_state: "INIT", target_duration_seconds: STAGE_TARGET_SECONDS.final });
    return getAssessmentCurrent(candidate);
  }
  if (current.latestScore?.score_status === "score_manual_review") {
    await updateStageProgress(progress.id, {
      current_state: "MANUAL_REVIEW_REQUIRED",
      active_question_id: current.current_question?.question_id ?? progress.active_question_id,
      score_status: current.latestScore?.score_status ?? "score_manual_review"
    });
    return getAssessmentCurrent(candidate);
  }
  if (progress.current_state !== "WAITING_NEXT_ACTION") return getAssessmentCurrent(candidate);
  return generateQuestion(candidate, progress.stage_key, progress, "followup", "GENERATING_NEXT_QUESTION", provider);
}

export async function assistantChat(candidate: Candidate, content: string, provider: ModelProvider) {
  const current = await getAssessmentCurrent(candidate);
  const progress = current.activeProgress;
  const question = current.current_question;
  const session = current.session;
  const modelName = provider === "openai" ? process.env.OPENAI_MODEL ?? "gpt-4o-mini" : process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const userMessage = await addChatMessage({
    candidate_id: candidate.id,
    stage_key: progress?.stage_key,
    question_id: question?.question_id,
    session_id: session?.session_id,
    role: "candidate",
    content,
    model_name: modelName
  });
  const reply = await generateWorkspaceReply({
    candidate,
    stage: progress ? fakeStage(progress.stage_key) : undefined,
    modelProvider: provider,
    userMessage: content
  });
  const modelMessage = await addChatMessage({
    candidate_id: candidate.id,
    stage_key: progress?.stage_key,
    question_id: question?.question_id,
    session_id: session?.session_id,
    role: "model",
    content: reply,
    model_name: modelName
  });
  return { userMessage, modelMessage };
}

export async function finalSubmit(candidate: Candidate, input: { final_solution: string; ai_usage_note: string; provider: ModelProvider }) {
  const current = await getAssessmentCurrent(candidate);
  const ability = current.progressRows.find((row) => row.stage_key === "ability");
  if (!ability || ability.current_state !== "ABILITY_STAGE_COMPLETED") throw new Error("ability_stage_not_completed");
  const finalProgress = await ensureStageProgress({ candidate_id: candidate.id, stage_key: "final", current_state: "INIT", target_duration_seconds: STAGE_TARGET_SECONDS.final });
  await updateStageProgress(finalProgress.id, { current_state: "SCORING" });
  await updateCandidate(candidate.id, {
    final_solution: input.final_solution,
    ai_usage_note: input.ai_usage_note,
    status: "submitted"
  });
  const turnScores = await listAssessmentScores(candidate.id);
  const evaluation = decideFinalSubmitScore(input.final_solution);
  const report = await addFinalReviewReport({
    candidate_id: candidate.id,
    final_profile_json: evaluation,
    basic_stage_summary: summarizeStageScores(turnScores, "basic"),
    ability_stage_summary: summarizeStageScores(turnScores, "ability"),
    final_evaluation_summary: evaluation.reason_summary,
    supervisor_scores_json: current.stageEvaluations,
    overall_score: evaluation.average_score,
    overall_comment: evaluation.reason_summary,
    pass_decision: evaluation.recommendation,
    probation_assessment_suggestions: evaluation.reviewer_notes,
    verification_focus_points: evaluation.evidence_summary ?? [],
    risk_points: evaluation.risk_tags ?? [],
    report_text: evaluation.reason_summary
  });
  await addCandidateProfile({
    candidate_id: candidate.id,
    original_profile_json: candidate.persona_profile ?? {},
    updated_profile_json: evaluation,
    profile_comparison_json: { evidence_summary: evaluation.evidence_summary, risk_tags: evaluation.risk_tags },
    profile_summary: evaluation.reason_summary
  });
  await updateStageProgress(finalProgress.id, { current_state: "FINAL_EVALUATION_COMPLETED", score_status: "score_success" });
  await updateCandidate(candidate.id, { status: "assessment_completed", final_recommendation: evaluation.recommendation });
  await addAssessmentEvent({
    candidate_id: candidate.id,
    stage_key: "final",
    event_type: "stage_completed",
    event_payload: { report_id: (report as any).report_id, recommendation: evaluation.recommendation },
    ai_summary: evaluation.reason_summary,
    risk_tags: evaluation.risk_tags
  });
  return report;
}

async function generateQuestion(
  candidate: Candidate,
  stageKey: AssessmentStageKey,
  progress: { id: string; current_question_index?: number | null; dimension_progress_json?: Record<string, unknown> | null },
  questionType: "initial" | "followup",
  state: AssessmentState,
  provider: ModelProvider
) {
  if (stageKey === "final") throw new Error("final_stage_does_not_generate_questions");
  const dimensions = dimensionsForStage(candidate, stageKey);
  const nextIndex = Number(progress.current_question_index ?? 0) + 1;
  const targetDuration = STAGE_TARGET_SECONDS[stageKey];
  const modelName = provider === "openai" ? process.env.OPENAI_MODEL ?? "gpt-4o-mini" : process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const promptVersion = `${stageKey}_stage/${questionType === "initial" ? "generate_first_question" : "generate_followup_question"}`;
  await updateStageProgress(progress.id, { current_state: state, generation_status: "running", last_error: null });
  const job = await createGenerationJob({
    candidate_id: candidate.id,
    stage_key: stageKey,
    job_type: questionType,
    provider,
    model_name: modelName,
    prompt_version: promptVersion,
    input_summary: `${candidate.name} / ${candidate.target_role} / ${stageKey} / question ${nextIndex}`
  });
  await addAssessmentEvent({
    candidate_id: candidate.id,
    stage_key: stageKey,
    event_type: "question_generation_started",
    event_payload: { job_id: job.job_id, questionType, nextIndex }
  });
  try {
    const agents = await listAgents();
    const stage = fakeStage(stageKey);
    let generated;
    if (questionType === "initial") {
      generated = await generateStageOpening({
        provider,
        candidate,
        stage,
        targetRole: candidate.target_role ?? "AI 产品经理",
        targetDifficulty: candidate.target_difficulty ?? "L2",
        abilityDimensions: dimensions,
        agents
      });
    } else {
      const current = await getAssessmentCurrent(candidate);
      const scores = await listAssessmentScores(candidate.id, stageKey);
      const selectedAgent = agents.find((agent) => agent.status === "enabled") ?? agents[0];
      if (!selectedAgent) throw new Error("agent_not_configured");
      generated = await generateFollowUp({
        provider,
        candidateAnswer: current.answer?.answer_text ?? "",
        currentStage: stage,
        agentConfig: selectedAgent,
        conversationHistory: [],
        abilityPlan: { role: candidate.target_role ?? "AI 产品经理", generated_by: provider, dimensions, agent_participation: [], question_strategy: [] },
        turnScore: scores[scores.length - 1]
      });
    }
    const generatedQuestion = generated as { question: string; dimension_key?: string; target_dimensions?: string[] };
    const dimensionKey = generatedQuestion.dimension_key ?? generatedQuestion.target_dimensions?.[0] ?? dimensions[(nextIndex - 1) % dimensions.length]?.key;
    const question = await createQuestion({
      candidate_id: candidate.id,
      stage_key: stageKey,
      dimension_key: dimensionKey,
      question_type: questionType,
      question_text: generated.question,
      question_context_json: generated,
      target_duration_seconds: targetDuration,
      prompt_version: promptVersion,
      model_name: modelName,
      generation_job_id: job.job_id,
      status: "active"
    });
    const session = await createAnswerSession({
      candidate_id: candidate.id,
      stage_key: stageKey,
      question_id: question.question_id,
      question_text_snapshot: question.question_text
    });
    await updateGenerationJob(job.job_id, {
      generation_status: "success",
      question_id: question.question_id,
      output_text: generated.question,
      completed_at: new Date().toISOString()
    });
    await updateStageProgress(progress.id, {
      current_state: "ANSWERING",
      current_question_id: question.question_id,
      active_question_id: question.question_id,
      current_question_index: nextIndex,
      question_started_at: new Date().toISOString(),
      target_duration_seconds: targetDuration,
      current_dimension: dimensionKey,
      generation_status: "success"
    });
    await addAssessmentEvent({
      candidate_id: candidate.id,
      stage_key: stageKey,
      question_id: question.question_id,
      session_id: session.session_id,
      event_type: "question_generation_success",
      event_payload: { job_id: job.job_id, dimensionKey },
      ai_summary: generated.question
    });
    await addAssessmentEvent({
      candidate_id: candidate.id,
      stage_key: stageKey,
      question_id: question.question_id,
      session_id: session.session_id,
      event_type: "answering_started",
      event_payload: { targetDuration }
    });
    return getAssessmentCurrent(candidate);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateGenerationJob(job.job_id, { generation_status: "failed", last_error: message, completed_at: new Date().toISOString() });
    await updateStageProgress(progress.id, { current_state: "GENERATION_FAILED", generation_status: "failed", last_error: message });
    await addAssessmentEvent({
      candidate_id: candidate.id,
      stage_key: stageKey,
      event_type: "question_generation_failed",
      event_payload: { job_id: job.job_id, error: message }
    });
    throw error;
  }
}

function buildTiming(progress?: { question_started_at?: string | null; target_duration_seconds?: number | null }) {
  const elapsed = elapsedSeconds(progress?.question_started_at);
  const target = progress?.target_duration_seconds ?? 0;
  const remaining = target ? target - elapsed : 0;
  return {
    elapsed_seconds: elapsed,
    target_duration_seconds: target,
    remaining_seconds: remaining,
    is_overtime: target > 0 && elapsed > target,
    should_auto_submit: target > 0 && elapsed >= target * 2,
    timeout_level: timeoutLevel(elapsed, target)
  };
}

function buildButton(progress: any, question: any, answer: any, score: any) {
  if (!progress) return { label: "进入基础关卡", action: "start_first_question", disabled: false };
  if (progress.stage_key === "final" && progress.current_state === "INIT") return { label: "进入最终评价", action: "final_submit", disabled: false };
  if (progress.current_state === "INIT") return { label: "进入第一题", action: "start_first_question", disabled: false };
  if (progress.current_state === "GENERATION_FAILED") return { label: "重新生成题目", action: "start_first_question", disabled: false };
  if (progress.current_state === "GENERATING_FIRST_QUESTION" || progress.current_state === "GENERATING_NEXT_QUESTION") {
    return { label: "AI 正在生成题目，请稍候", action: "wait", disabled: true };
  }
  if ((progress.current_state === "ANSWERING" || progress.current_state === "ANSWERING_OVERTIME") && question && !answer) {
    return { label: "提交回答", action: "submit_answer", disabled: false };
  }
  if (progress.current_state === "SUBMITTING_ANSWER" || progress.current_state === "SCORING" || (answer && !score)) {
    return { label: "AI 正在评分，请稍候", action: "score_answer", disabled: false };
  }
  if (progress.current_state === "MANUAL_REVIEW_REQUIRED" || score?.score_status === "score_manual_review") {
    return { label: "你的回答不通过，等待人工复核", action: "wait", disabled: true };
  }
  if (progress.current_state === "WAITING_NEXT_ACTION") return { label: "进入追问题", action: "next_question", disabled: false };
  if (progress.current_state === "BASIC_STAGE_COMPLETED") return { label: "进入能力关卡", action: "next_question", disabled: false };
  if (progress.current_state === "ABILITY_STAGE_COMPLETED") return { label: "提交最终方案", action: "final_submit", disabled: false };
  if (progress.current_state === "FINAL_EVALUATION_COMPLETED" || progress.current_state === "COMPLETED") {
    return { label: "考核已完成", action: "done", disabled: true };
  }
  if (progress.current_state === "SCORE_FAILED") return { label: "评分失败，请重试", action: "score_answer", disabled: false };
  return { label: "继续", action: "current", disabled: false };
}

function elapsedSeconds(startedAt?: string | null) {
  if (!startedAt) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
}

function dimensionsForStage(candidate: Candidate, stageKey: AssessmentStageKey): AbilityDimension[] {
  if (stageKey === "basic") return basicStageDimensions;
  return candidate.ability_plan?.dimensions?.length ? candidate.ability_plan.dimensions : basicStageDimensions;
}

function fakeStage(stageKey: AssessmentStageKey): Stage {
  return {
    id: stageKey,
    candidate_id: "",
    name: stageKey === "ability" ? ABILITY_STAGE : BASIC_STAGE,
    status: "in_progress",
    target_duration_seconds: STAGE_TARGET_SECONDS[stageKey]
  };
}

function decideTestScore(answerText: string, questionIndex: number): {
  answerLength: number;
  contentScore: number;
  finalScore: number;
  scoreStatus: string;
  nextAction: "manual_review" | "follow_up" | "pass";
  reason: string;
} {
  const answerLength = Array.from(answerText.replace(/\s/g, "")).length;
  if (answerLength < 10) {
    return {
      answerLength,
      contentScore: 20,
      finalScore: 20,
      scoreStatus: "score_manual_review",
      nextAction: "manual_review",
      reason: `测试评分规则：正式回答有效字符数 ${answerLength}，低于 10，直接进入人工复核。`
    };
  }
  if (answerLength < 30 && questionIndex < 3) {
    return {
      answerLength,
      contentScore: 68,
      finalScore: 68,
      scoreStatus: "score_warning",
      nextAction: "follow_up",
      reason: `测试评分规则：正式回答有效字符数 ${answerLength}，介于 10 到 30，进入追问。`
    };
  }
  if (answerLength < 30) {
    return {
      answerLength,
      contentScore: 82,
      finalScore: 82,
      scoreStatus: "score_passed",
      nextAction: "pass",
      reason: `测试评分规则：已完成最多两次追问，正式回答有效字符数 ${answerLength}，本轮按通过处理。`
    };
  }
  return {
    answerLength,
    contentScore: 92,
    finalScore: 92,
    scoreStatus: "score_passed",
    nextAction: "pass",
    reason: `测试评分规则：正式回答有效字符数 ${answerLength}，达到 30 以上，直接通过。`
  };
}

function decideFinalSubmitScore(finalSolution: string) {
  const answerLength = Array.from(finalSolution.replace(/\s/g, "")).length;
  if (answerLength < 10) {
    return {
      average_score: 20,
      recommendation: "Cut" as const,
      reason_summary: `最终评价测试评分：最终方案有效字符数 ${answerLength}，低于 10，建议不通过并进入人工复核。`,
      reviewer_notes: "最终方案内容不足，建议审核人复核。",
      evidence_summary: [`有效字符数 ${answerLength}`],
      risk_tags: ["final_solution_too_short"]
    };
  }
  if (answerLength < 30) {
    return {
      average_score: 68,
      recommendation: "继续观察" as const,
      reason_summary: `最终评价测试评分：最终方案有效字符数 ${answerLength}，介于 10 到 30，建议继续观察。`,
      reviewer_notes: "最终方案较短，建议试用期继续验证表达完整度。",
      evidence_summary: [`有效字符数 ${answerLength}`],
      risk_tags: ["final_solution_brief"]
    };
  }
  return {
    average_score: 92,
    recommendation: "通过" as const,
    reason_summary: `最终评价测试评分：最终方案有效字符数 ${answerLength}，达到 30 以上，建议通过。`,
    reviewer_notes: "最终方案达到测试通过标准，审核人仍可复核具体作答。",
    evidence_summary: [`有效字符数 ${answerLength}`],
    risk_tags: []
  };
}

function renderSessionText(question: string, answer: string, aiUsageNote: string) {
  return `题目：\n${question}\n\n候选人回答：\n${answer}\n\nAI 使用说明：\n${aiUsageNote}`;
}

function summarizeStageScores(scores: TurnScore[], stageKey: AssessmentStageKey) {
  const stageScores = scores.filter((score) => score.stage_key === stageKey);
  if (!stageScores.length) return "暂无评分记录。";
  const average = stageScores.reduce((sum, score) => sum + Number(score.average_score ?? 0), 0) / stageScores.length;
  return `${stageKey} 阶段共 ${stageScores.length} 题，平均分 ${average.toFixed(1)}。`;
}
