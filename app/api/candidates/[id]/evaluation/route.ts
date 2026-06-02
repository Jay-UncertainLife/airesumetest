import { NextResponse } from "next/server";
import { updateCandidate } from "@/lib/repositories/candidates";
import { addEvent } from "@/lib/repositories/events";
import { jsonError, readJson } from "@/lib/apiUtils";
import { Recommendation } from "@/lib/types";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ human_review_result: Recommendation; human_review_comment?: string }>(request);
    const candidate = await updateCandidate(params.id, {
      status: "reviewed",
      final_recommendation: body.human_review_result
    });
    await addEvent({
      candidate_id: params.id,
      event_type: "human_review_completed",
      raw_content: body.human_review_comment ?? "",
      ai_summary: `人工复核结果：${body.human_review_result}`
    });
    return NextResponse.json({ candidate });
  } catch (error) {
    return jsonError(error, "human_review_failed");
  }
}
