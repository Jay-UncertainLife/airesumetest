import { Agent } from "@/lib/types";
import { db, many, one } from "./db";

export async function listAgents() {
  return many<Agent>(db().from("agents").select("*").order("created_at", { ascending: true }));
}

export async function getAgent(id: string) {
  return one<Agent>(db().from("agents").select("*").eq("id", id).single());
}

export async function createAgent(input: Omit<Agent, "id" | "created_at">) {
  return one<Agent>(db().from("agents").insert(input).select("*").single());
}

export async function updateAgent(id: string, patch: Partial<Agent>) {
  return one<Agent>(db().from("agents").update(patch).eq("id", id).select("*").single());
}

export async function deleteAgent(id: string) {
  const { error } = await db().from("agents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
