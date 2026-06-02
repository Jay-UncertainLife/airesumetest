import { NextResponse } from "next/server";
import { getCandidateByToken, publicInviteFromCandidate } from "@/lib/repositories/candidates";
import { jsonError } from "@/lib/apiUtils";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { token: string } }) {
  try {
    const candidate = await getCandidateByToken(params.token);
    if (!candidate) return NextResponse.json({ error: "invalid_invite_token" }, { status: 404 });
    return NextResponse.json({ invite: publicInviteFromCandidate(candidate) });
  } catch (error) {
    return jsonError(error, "candidate_invite_failed");
  }
}
