import { NextResponse } from "next/server";
import { createCandidate, listCandidates } from "@/lib/repositories/candidates";
import { jsonError, readJson } from "@/lib/apiUtils";
import { CandidateCreateInput } from "@/lib/repositories/candidates";
import { listAssessmentScores, listStageProgress } from "@/lib/repositories/assessment";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const candidates = await listCandidates();
    const enriched = await Promise.all(candidates.map(async (candidate) => {
      const [progressRows, scores] = await Promise.all([
        listStageProgress(candidate.id),
        listAssessmentScores(candidate.id)
      ]);
      const activeProgress =
        progressRows.find((row) => row.current_state === "MANUAL_REVIEW_REQUIRED") ??
        progressRows.find((row) => !["BASIC_STAGE_COMPLETED", "ABILITY_STAGE_COMPLETED", "FINAL_EVALUATION_COMPLETED", "COMPLETED"].includes(row.current_state)) ??
        progressRows[progressRows.length - 1];
      const needsManualReview =
        activeProgress?.current_state === "MANUAL_REVIEW_REQUIRED" ||
        scores.some((score) => score.score_status === "score_manual_review");
      return {
        ...candidate,
        assessment_stage_key: activeProgress?.stage_key ?? null,
        assessment_state: activeProgress?.current_state ?? null,
        match_status_label: matchStatusLabel(candidate.status, activeProgress?.stage_key, activeProgress?.current_state),
        pass_status_label: passStatusLabel(candidate.final_recommendation, candidate.status, needsManualReview)
      };
    }));
    return NextResponse.json({ candidates: enriched });
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

function matchStatusLabel(status: string, stageKey?: string | null, state?: string | null) {
  if (!state) {
    const labels: Record<string, string> = {
      created: "已建档",
      profiled: "画像已生成",
      invited: "已发链接",
      in_progress: "磨合中",
      assessment_started: "磨合中",
      assessment_completed: "磨合完成",
      reviewed: "已复核"
    };
    return labels[status] ?? status;
  }
  if (state === "MANUAL_REVIEW_REQUIRED") return "待人工复核";
  if (state === "COMPLETED" || state === "FINAL_EVALUATION_COMPLETED") return "磨合完成";
  const stageLabels: Record<string, string> = { basic: "基础关卡", ability: "能力关卡", final: "最终评价" };
  const stateLabels: Record<string, string> = {
    INIT: "待开始",
    GENERATING_FIRST_QUESTION: "生成题目中",
    GENERATING_NEXT_QUESTION: "生成追问题中",
    ANSWERING: "作答中",
    ANSWERING_OVERTIME: "超时作答中",
    SUBMITTING_ANSWER: "提交中",
    SCORING: "评分中",
    WAITING_NEXT_ACTION: "等待追问",
    BASIC_STAGE_COMPLETED: "基础完成",
    ABILITY_STAGE_COMPLETED: "能力完成",
    SCORE_FAILED: "评分失败",
    GENERATION_FAILED: "生成失败"
  };
  return `${stageLabels[stageKey ?? ""] ?? "磨合"} / ${stateLabels[state] ?? state}`;
}

function passStatusLabel(recommendation?: string | null, status?: string, needsManualReview?: boolean) {
  if (recommendation) return recommendation;
  if (needsManualReview) return "待人工复核";
  if (status === "assessment_completed") return "通过";
  if (status === "reviewed") return "已复核";
  return "待复核";
}
