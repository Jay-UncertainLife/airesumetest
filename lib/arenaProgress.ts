import { Message, Stage, TurnScore } from "./types";
import { BASIC_STAGE, ABILITY_STAGE, normalizeStageName, stageRank } from "./stageNames";

export function buildArenaProgress(input: {
  stages: Stage[];
  messages: Message[];
  turnScores: TurnScore[];
}) {
  const stages = input.stages.map((stage) => ({ ...stage, name: normalizeStageName(String(stage.name)) }));
  const currentStage = pickCurrentStage(stages, input.messages);
  const currentScores = currentStage ? input.turnScores.filter((score) => score.stage_id === currentStage.id) : [];
  const latestScore = currentScores[currentScores.length - 1] ?? null;
  const requiredTurns = requiredTurnsForStage(currentScores);
  const answeredTurns = currentScores.length;
  const stageComplete = Boolean(currentStage && answeredTurns >= requiredTurns && latestScore?.recommendation !== "Cut");
  const currentName = currentStage ? normalizeStageName(String(currentStage.name)) : null;

  return {
    currentStage,
    latestScore,
    answeredTurns,
    requiredTurns,
    remainingTurns: Math.max(requiredTurns - answeredTurns, 0),
    stageComplete,
    canAdvanceStage: Boolean(currentName === BASIC_STAGE && stageComplete),
    canSubmitFinal: Boolean(currentName === ABILITY_STAGE && stageComplete)
  };
}

export function requiredTurnsForStage(scores: TurnScore[]) {
  const latest = scores[scores.length - 1];
  if (!latest) return 2;
  if (latest.average_score >= 80 && latest.recommendation === "通过") return 2;
  return 3;
}

export function pickCurrentStage(stages: Stage[], messages: Message[]) {
  const stageIdsWithAiQuestions = new Set(messages.filter((message) => message.role === "ai").map((message) => message.stage_id));
  const activeWithQuestions = stages.filter((stage) => stage.status === "in_progress" && stageIdsWithAiQuestions.has(stage.id));
  if (activeWithQuestions.length) return activeWithQuestions.sort((a, b) => stageRank(b.name) - stageRank(a.name))[0];
  const active = stages.filter((stage) => stage.status === "in_progress");
  if (active.length) return active.sort((a, b) => stageRank(b.name) - stageRank(a.name))[0];
  const withQuestions = stages.filter((stage) => stageIdsWithAiQuestions.has(stage.id));
  if (withQuestions.length) return withQuestions.sort((a, b) => stageRank(b.name) - stageRank(a.name))[0];
  return stages.sort((a, b) => stageRank(b.name) - stageRank(a.name))[0] ?? null;
}
