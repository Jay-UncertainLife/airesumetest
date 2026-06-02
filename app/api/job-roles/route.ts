import { NextResponse } from "next/server";
import { listJobRoles, updateJobRole } from "@/lib/repositories/jobRoles";
import { jsonError, readJson } from "@/lib/apiUtils";
import { JobRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ jobRoles: await listJobRoles() });
  } catch (error) {
    return jsonError(error, "job_roles_list_failed");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readJson<Partial<JobRole> & { id: string }>(request);
    if (!body.id) return NextResponse.json({ error: "job_role_id_required" }, { status: 400 });
    const jobRole = await updateJobRole(body.id, body);
    return NextResponse.json({ jobRole });
  } catch (error) {
    return jsonError(error, "job_role_update_failed");
  }
}
