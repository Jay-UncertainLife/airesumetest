import { NextResponse } from "next/server";
import { updateCandidate } from "@/lib/repositories/candidates";
import { addEvent } from "@/lib/repositories/events";
import { jsonError, readJson } from "@/lib/apiUtils";
import { Recommendation } from "@/lib/types";
import { addAssessmentEvent, listStageProgress, updateStageProgress } from "@/lib/repositories/assessment";

async function handleReview(request: Request, { params }: { params: { id: string } }) {
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
    const progressRows = await listStageProgress(params.id);
    await Promise.all(progressRows.map((progress) => updateStageProgress(progress.id, {
      current_state: "COMPLETED",
      active_question_id: null,
      score_status: body.human_review_result === "Cut" ? "score_manual_review" : "score_success",
      dimension_progress_json: {
        ...(progress.dimension_progress_json ?? {}),
        human_review_result: body.human_review_result,
        human_review_comment: body.human_review_comment ?? ""
      }
    })));
    await addAssessmentEvent({
      candidate_id: params.id,
      event_type: "human_review_completed",
      event_source: "reviewer",
      event_payload: {
        result: body.human_review_result,
        comment: body.human_review_comment ?? ""
      },
      raw_content: body.human_review_comment ?? "",
      ai_summary: `人工复核结果：${body.human_review_result}`
    });
    return NextResponse.json({ candidate, ok: true });
  } catch (error) {
    return jsonError(error, "human_review_failed");
  }
}

export async function POST(request: Request, context: { params: { id: string } }) {
  return handleReview(request, context);
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  return handleReview(request, context);
}
