import { Evaluation, TurnScore } from "@/lib/types";
import { db, many, maybeOne, one } from "./db";

export async function listTurnScores(candidateId: string) {
  return many<TurnScore>(db().from("turn_scores").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: true }));
}

export async function addTurnScore(input: Omit<TurnScore, "id" | "created_at">) {
  return one<TurnScore>(db().from("turn_scores").insert(input).select("*").single());
}

export async function getFinalEvaluation(candidateId: string) {
  return maybeOne<Evaluation>(
    db().from("final_evaluations").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: false }).limit(1).maybeSingle()
  );
}

export async function addFinalEvaluation(input: Omit<Evaluation, "id" | "created_at">) {
  return one<Evaluation>(db().from("final_evaluations").insert(input).select("*").single());
}
