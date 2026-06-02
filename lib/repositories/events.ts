import { EventLog } from "@/lib/types";
import { db, many, one } from "./db";

export async function listEvents(candidateId: string) {
  return many<EventLog>(db().from("event_logs").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: true }));
}

export async function addEvent(input: Omit<EventLog, "id" | "created_at">) {
  return one<EventLog>(db().from("event_logs").insert(input).select("*").single());
}
