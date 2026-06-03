import BackLink from "@/app/components/BackLink";
import ReviewActions from "./ReviewActions";
import { getReviewerOverview, getReviewerStage } from "@/lib/reviewerAssessment";
import { formatChinaTime } from "@/lib/stageNames";

export const dynamic = "force-dynamic";

export default async function AdminCandidateDetailPage({ params }: { params: { id: string } }) {
  const overview = await getReviewerOverview(params.id);
  if (!overview) return <div className="container"><BackLink />候选人不存在</div>;
  const [basic, ability, finalStage] = await Promise.all([
    getReviewerStage(params.id, "basic"),
    getReviewerStage(params.id, "ability"),
    getReviewerStage(params.id, "final")
  ]);
  const candidate = overview.candidate;
  const persona = overview.originalProfile;
  const matchStatus = overview.needsManualReview
    ? "待人工复核"
    : overview.currentState
      ? `${overview.currentStage} / ${stateLabel(overview.currentState)}`
      : statusLabel(candidate.status);
  const passStatus = candidate.final_recommendation ?? (candidate.status === "assessment_completed" ? "通过" : overview.needsManualReview ? "待人工复核" : "待复核");

  return (
    <div className="container admin-review-page">
      <BackLink />
      <h1 className="title">{candidate.name} 的考核档案</h1>

      <section className="panel">
        <div className="grid grid-4">
          <Info label="目标岗位" value={candidate.target_role ?? "-"} />
          <Info label="目标难度" value={candidate.target_difficulty ?? "-"} />
          <Info label="磨合状态" value={matchStatus} />
          <Info label="主表状态" value={statusLabel(candidate.status)} />
          <Info label="高风险" value={overview.hasHighRisk ? "是" : "否"} />
          <Info label="人工复核" value={overview.needsManualReview ? "需要" : "暂无"} />
          <Info label="面试评价数" value={String(candidate.interviewer_evaluations?.length ?? 0)} />
          <Info label="通过状态" value={passStatus} />
        </div>
        {candidate.invite_url ? <p className="badge" style={{ marginTop: 12 }}>专属链接：{candidate.invite_url}</p> : null}
      </section>

      <section className="review-tabs">
        <article className="panel">
          <h2>候选人画像</h2>
          {persona ? (
            <div className="profile-grid">
              <div>
                <h3>原始画像</h3>
                <p>{persona.summary}</p>
                <p><strong>岗位匹配：</strong>{persona.role_fit}</p>
                <div className="actions">{persona.strengths?.map((item: string) => <span className="badge" key={item}>{item}</span>)}</div>
                <div className="actions">{persona.risks?.map((item: string) => <span className="badge watch" key={item}>{item}</span>)}</div>
              </div>
              <div>
                <h3>最终新画像</h3>
                {overview.updatedProfile ? (
                  <>
                    <p>{String((overview.updatedProfile as any).profile_summary ?? "")}</p>
                    {(overview.updatedProfile as any).updated_profile_json ? (
                      <p className="message ai">{String((overview.updatedProfile as any).updated_profile_json?.reason_summary ?? "")}</p>
                    ) : null}
                  </>
                ) : <p className="muted">尚未生成最终新画像。</p>}
              </div>
            </div>
          ) : <p className="muted">尚未生成候选人画像。</p>}
        </article>

        <StagePanel title="基础关卡" detail={basic} />
        <StagePanel title="能力关卡" detail={ability} />

        <article className="panel">
          <h2>最终评价</h2>
          <p><strong>作答记录确认</strong></p>
          <p className="message candidate">{candidate.final_solution ?? "候选人尚未提交最终方案。"}</p>
          <p><strong>候选人最终反馈</strong></p>
          <p className="message candidate">{candidate.ai_usage_note ?? "候选人尚未填写最终反馈。"}</p>
          <StagePanel title="最终评价过程" detail={finalStage} embedded />
        </article>

        <article className="panel">
          <h2>评审报告</h2>
          {overview.finalReport ? (
            <>
              <p><strong>{String((overview.finalReport as any).overall_score ?? "-")} 分 / {String((overview.finalReport as any).pass_decision ?? "-")}</strong></p>
              <p>{String((overview.finalReport as any).overall_comment ?? (overview.finalReport as any).report_text ?? "")}</p>
              <p className="muted">生成时间：{formatChinaTime(String((overview.finalReport as any).created_at ?? ""))}</p>
              <ReviewActions candidateId={candidate.id} />
            </>
          ) : (
            <>
              <p className="muted">尚未生成最终评审报告。</p>
              <ReviewActions candidateId={candidate.id} />
            </>
          )}
        </article>
      </section>
    </div>
  );
}

function StagePanel({ title, detail, embedded = false }: { title: string; detail: any; embedded?: boolean }) {
  const Wrapper = embedded ? "div" : "article";
  return (
    <Wrapper className={embedded ? "" : "panel"}>
      <h2>{title}</h2>
      {detail?.questions?.length ? detail.questions.map((item: any, index: number) => (
        <section className={`review-question-card ${Number(item.score?.average_score ?? 100) < 60 ? "risk" : ""}`} key={item.question_id}>
          <div className="actions" style={{ justifyContent: "space-between" }}>
            <strong>题目 {index + 1}</strong>
            {item.score ? <span className="badge">{item.score.average_score} / {item.score.score_status ?? item.score.recommendation}</span> : <span className="badge">未评分</span>}
          </div>
          <p>{item.question_text}</p>
          <p><strong>候选人答案</strong></p>
          <p className="message candidate">{item.answer?.answer_text ?? "尚未提交。"}</p>
          {item.score ? (
            <div className="score-block">
              <p>{item.score.reason_summary}</p>
              <p className="muted">时间系数：{String(item.score.time_coefficient ?? "-")} / 超时等级：{item.score.timeout_level ?? "-"}</p>
            </div>
          ) : null}
        </section>
      )) : <p className="muted">暂无该阶段记录。</p>}

      {detail?.evaluations?.length ? (
        <div className="stage-evaluation-list">
          <h3>人工阶段评估</h3>
          {detail.evaluations.map((evaluation: any) => (
            <div className="event" key={evaluation.evaluation_id}>
              <div className="event-type">{evaluation.evaluator_role} / {evaluation.score ?? "-"} 分</div>
              <div>{evaluation.evaluation_text}</div>
            </div>
          ))}
        </div>
      ) : <p className="muted">暂无业务主管或培训主管阶段评估。</p>}
    </Wrapper>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><strong>{label}</strong><p>{value}</p></div>;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    created: "已建档",
    profiled: "画像已生成",
    invited: "已发链接",
    in_progress: "磨合中",
    assessment_started: "磨合中",
    submitted: "已提交",
    evaluated: "已评分",
    reviewed: "已复核",
    assessment_completed: "磨合完成"
  };
  return labels[status] ?? status;
}

function stateLabel(state: string) {
  const labels: Record<string, string> = {
    INIT: "待开始",
    GENERATING_FIRST_QUESTION: "生成题目中",
    GENERATING_NEXT_QUESTION: "生成追问题中",
    ANSWERING: "作答中",
    ANSWERING_OVERTIME: "超时作答中",
    SUBMITTING_ANSWER: "提交中",
    SCORING: "评分中",
    WAITING_NEXT_ACTION: "等待追问",
    MANUAL_REVIEW_REQUIRED: "待人工复核",
    BASIC_STAGE_COMPLETED: "基础完成",
    ABILITY_STAGE_COMPLETED: "能力完成",
    FINAL_EVALUATION_COMPLETED: "最终评价完成",
    COMPLETED: "已结束",
    SCORE_FAILED: "评分失败",
    GENERATION_FAILED: "生成失败"
  };
  return labels[state] ?? state;
}
