import { getAssessmentCurrent } from "./assessmentFlow";
import { AssessmentStageKey } from "./assessmentTypes";
import { getCandidateDetail } from "./repositories/candidates";
import { listEvents } from "./repositories/events";
import {
  getLatestCandidateProfile,
  getLatestFinalReviewReport,
  listAnswers,
  listAssessmentScores,
  listQuestions,
  listStageEvaluations
} from "./repositories/assessment";

export async function getReviewerOverview(candidateId: string) {
  const candidate = await getCandidateDetail(candidateId);
  if (!candidate) return null;
  const [current, events, evaluations, profile, report] = await Promise.all([
    getAssessmentCurrent(candidate),
    listEvents(candidateId),
    listStageEvaluations(candidateId),
    getLatestCandidateProfile(candidateId),
    getLatestFinalReviewReport(candidateId)
  ]);
  const scores = current.scores;
  const hasHighRisk = scores.some((score) => Number(score.average_score ?? 100) < 60 || score.score_status === "score_manual_review");
  return {
    candidate,
    currentStage: current.stage_name,
    currentState: current.activeProgress?.current_state,
    progressRows: current.progressRows,
    originalProfile: candidate.persona_profile,
    updatedProfile: profile as any,
    finalReport: report as any,
    stageEvaluations: evaluations,
    hasHighRisk,
    needsManualReview: hasHighRisk || events.some((event) => event.event_type === "manual_review_required")
  };
}

export async function getReviewerStage(candidateId: string, stageKey: AssessmentStageKey) {
  const candidate = await getCandidateDetail(candidateId);
  if (!candidate) return null;
  const [questions, answers, scores, events, evaluations] = await Promise.all([
    listQuestions(candidateId, stageKey),
    listAnswers(candidateId, stageKey),
    listAssessmentScores(candidateId, stageKey),
    listEvents(candidateId),
    listStageEvaluations(candidateId)
  ]);
  return {
    candidate,
    stageKey,
    questions: questions.map((question) => ({
      ...question,
      answer: answers.find((answer) => answer.question_id === question.question_id) ?? null,
      score: scores.find((score) => score.question_id === question.question_id) ?? null,
      events: events.filter((event) => (event as any).question_id === question.question_id)
    })),
    scores,
    evaluations: evaluations.filter((evaluation: any) => evaluation.stage_key === stageKey)
  };
}
