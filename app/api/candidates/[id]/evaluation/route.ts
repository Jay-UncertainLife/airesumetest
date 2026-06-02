import { NextResponse } from "next/server";
import { addEvent, readStore, writeStore } from "@/lib/store";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { human_review_result, human_review_comment } = await request.json();
  const store = await readStore();
  const evaluation = store.evaluations.find((item) => item.candidate_id === params.id);
  const candidate = store.candidates.find((item) => item.id === params.id);
  if (!evaluation || !candidate) return NextResponse.json({ error: "evaluation not found" }, { status: 404 });
  evaluation.human_review_result = human_review_result;
  evaluation.human_review_comment = human_review_comment;
  candidate.status = "reviewed";
  candidate.final_recommendation = human_review_result;
  addEvent(store, {
    candidate_id: params.id,
    event_type: "reviewer_viewed_report",
    raw_content: `审核人员确认最终结果：${human_review_result}`,
    ai_summary: human_review_comment
  });
  await writeStore(store);
  return NextResponse.json({ evaluation });
}
