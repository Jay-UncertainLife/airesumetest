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

  return (
    <div className="container admin-review-page">
      <BackLink />
      <h1 className="title">{candidate.name} 的考核档案</h1>

      <section className="panel">
        <div className="grid grid-4">
          <Info label="目标岗位" value={candidate.target_role ?? "-"} />
          <Info label="目标难度" value={candidate.target_difficulty ?? "-"} />
          <Info label="当前阶段" value={`${overview.currentStage} / ${overview.currentState ?? "-"}`} />
          <Info label="总状态" value={candidate.status} />
          <Info label="高风险" value={overview.hasHighRisk ? "是" : "否"} />
          <Info label="人工复核" value={overview.needsManualReview ? "需要" : "暂无"} />
          <Info label="面试评价数" value={String(candidate.interviewer_evaluations?.length ?? 0)} />
          <Info label="最终建议" value={candidate.final_recommendation ?? "-"} />
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
                  <p>{String((overview.updatedProfile as any).profile_summary ?? "")}</p>
                ) : <p className="muted">尚未生成最终新画像。</p>}
              </div>
            </div>
          ) : <p className="muted">尚未生成候选人画像。</p>}
        </article>

        <StagePanel title="基础关卡" detail={basic} />
        <StagePanel title="能力关卡" detail={ability} />

        <article className="panel">
          <h2>最终评价</h2>
          <p><strong>最终方案</strong></p>
          <p className="message candidate">{candidate.final_solution ?? "候选人尚未提交最终方案。"}</p>
          <p><strong>AI 使用说明</strong></p>
          <p className="message ai">{candidate.ai_usage_note ?? "暂无说明。"}</p>
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
          <p><strong>AI 使用说明</strong></p>
          <p className="message ai">{item.answer?.ai_usage_note ?? "暂无说明。"}</p>
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
