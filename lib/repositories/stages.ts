import { Stage, StageName, StageStatus } from "@/lib/types";
import { db, many, maybeOne, one } from "./db";

export async function listStages(candidateId: string) {
  return many<Stage>(db().from("stages").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: true }));
}

export async function getActiveStage(candidateId: string) {
  const stages = await many<Stage>(
    db().from("stages").select("*").eq("candidate_id", candidateId).eq("status", "in_progress").order("created_at", { ascending: true })
  );
  return pickMostAdvancedStage(stages);
}

export async function getNextStage(candidateId: string) {
  return maybeOne<Stage>(db().from("stages").select("*").eq("candidate_id", candidateId).eq("status", "not_started").order("created_at", { ascending: true }).limit(1).maybeSingle());
}

export async function createStage(input: {
  candidate_id: string;
  name: StageName;
  status: StageStatus;
  target_duration_seconds?: number;
  started_at?: string;
}) {
  return one<Stage>(db().from("stages").insert(input).select("*").single());
}

export async function updateStage(id: string, patch: Partial<Stage>) {
  return one<Stage>(db().from("stages").update(patch).eq("id", id).select("*").single());
}

export async function completeOtherActiveStages(candidateId: string, activeStageId: string) {
  const { error } = await db()
    .from("stages")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("candidate_id", candidateId)
    .eq("status", "in_progress")
    .neq("id", activeStageId);
  if (error) throw new Error(error.message);
}

export async function resetStages(candidateId: string) {
  const { error } = await db().from("stages").delete().eq("candidate_id", candidateId);
  if (error) throw new Error(error.message);
}

function pickMostAdvancedStage(stages: Stage[]) {
  return stages.sort((a, b) => stageRank(b.name) - stageRank(a.name))[0] ?? null;
}

function stageRank(name: string) {
  if (name.includes("能力")) return 3;
  if (name.includes("基础")) return 2;
  return 1;
}
