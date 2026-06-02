import { NextResponse } from "next/server";
import { listCandidates } from "@/lib/repositories/candidates";
import { jsonError } from "@/lib/apiUtils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const candidates = await listCandidates();
    return NextResponse.json({ candidates });
  } catch (error) {
    return jsonError(error, "candidates_list_failed");
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "candidate_self_upload_disabled", message: "候选人不能主动上传简历，请由审核人员创建候选人并生成专属链接。" },
    { status: 403 }
  );
}
