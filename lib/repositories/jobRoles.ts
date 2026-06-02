import { JobRole } from "@/lib/types";
import { db, many, one } from "./db";

export async function listJobRoles() {
  return many<JobRole>(db().from("job_roles").select("*").order("created_at", { ascending: true }));
}

export async function updateJobRole(id: string, patch: Partial<JobRole>) {
  return one<JobRole>(
    db().from("job_roles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single()
  );
}
