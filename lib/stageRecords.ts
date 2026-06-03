import { EventLog, Message, Stage, TurnScore, WorkspaceMessage } from "./types";

export function buildStageRecords(input: {
  stages: Stage[];
  messages: Message[];
  workspaceMessages: WorkspaceMessage[];
  eventLogs: EventLog[];
  turnScores: TurnScore[];
}) {
  return input.stages.map((stage) => {
    const stageMessages = input.messages.filter((message) => message.stage_id === stage.id);
    const aiQuestions = stageMessages.filter((message) => message.role === "ai");
    const candidateAnswers = stageMessages.filter((message) => message.role === "candidate");
    const stageScores = input.turnScores.filter((score) => score.stage_id === stage.id);
    const answersWithScores = candidateAnswers.map((answer) => ({
      answer,
      score: stageScores.find((score) => score.message_id === answer.id) ?? null
    }));

    return {
      stage,
      questions: aiQuestions,
      answers: answersWithScores,
      messages: stageMessages,
      workspaceMessages: input.workspaceMessages.filter((message) => message.stage_id === stage.id),
      eventLogs: input.eventLogs.filter((event) => event.stage_id === stage.id),
      turnScores: stageScores
    };
  });
}
