import { Message, WorkspaceMessage } from "@/lib/types";
import { db, many, one } from "./db";

export async function listMessages(candidateId: string) {
  return many<Message>(db().from("messages").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: true }));
}

export async function addMessage(input: Omit<Message, "id" | "created_at">) {
  return one<Message>(db().from("messages").insert(input).select("*").single());
}

export async function listWorkspaceMessages(candidateId: string) {
  return many<WorkspaceMessage>(db().from("workspace_messages").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: true }));
}

export async function addWorkspaceMessage(input: Omit<WorkspaceMessage, "id" | "created_at">) {
  return one<WorkspaceMessage>(db().from("workspace_messages").insert(input).select("*").single());
}
