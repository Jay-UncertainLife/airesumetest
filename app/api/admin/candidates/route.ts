import { NextResponse } from "next/server";
import { createCandidate, listCandidates } from "@/lib/repositories/candidates";
import { jsonError, readJson } from "@/lib/apiUtils";
import { CandidateCreateInput } from "@/lib/repositories/candidates";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const candidates = await listCandidates();
    return NextResponse.json({ candidates });
  } catch (error) {
    return jsonError(error, "admin_candidates_list_failed");
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<CandidateCreateInput>(request);
    if (!body.name?.trim()) return NextResponse.json({ error: "name_required" }, { status: 400 });
    const candidate = await createCandidate({
      name: body.name.trim(),
      target_role: body.target_role || "AI 产品经理",
      target_difficulty: body.target_difficulty || "L2",
      resume_text: body.resume_text || "",
      resume_file_name: body.resume_file_name || "",
      interviewer_evaluations: body.interviewer_evaluations ?? []
    });
    return NextResponse.json({ candidate });
  } catch (error) {
    return jsonError(error, "admin_candidate_create_failed");
  }
}
