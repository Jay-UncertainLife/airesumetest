import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/apiUtils";
import { upsertStageEvaluation } from "@/lib/repositories/assessment";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ stage_key: "basic" | "ability" | "final"; evaluator_role: string; score?: number; evaluation_text?: string; verification_points?: unknown }>(request);
    const evaluation = await upsertStageEvaluation({
      candidate_id: params.id,
      stage_key: body.stage_key,
      evaluator_role: body.evaluator_role,
      score: body.score ?? null,
      evaluation_text: body.evaluation_text ?? "",
      verification_points: body.verification_points ?? []
    });
    return NextResponse.json({ evaluation });
  } catch (error) {
    return jsonError(error, "reviewer_stage_evaluation_failed");
  }
}
