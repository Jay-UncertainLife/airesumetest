import { readStore } from "@/lib/store";
import AbilityPlanView from "@/app/components/AbilityPlanView";
import BackLink from "@/app/components/BackLink";
import ReviewActions from "./ReviewActions";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({ params }: { params: { id: string } }) {
  const store = await readStore();
  const candidate = store.candidates.find((item) => item.id === params.id);
  if (!candidate) return <div className="container">候选人不存在</div>;

  const messages = store.messages.filter((item) => item.candidate_id === params.id);
  const workspaceMessages = store.workspaceMessages.filter((item) => item.candidate_id === params.id);
  const events = store.eventLogs.filter((item) => item.candidate_id === params.id);
  const needsHumanReview = events.some((event) => event.event_type === "human_review_required");
  const evaluation = store.evaluations.find((item) => item.candidate_id === params.id);
  const stages = store.stages.filter((item) => item.candidate_id === params.id);
  const turnScores = store.turnScores.filter((item) => item.candidate_id === params.id);

  return (
    <div className="container">
      <BackLink />
      <h1 className="title">{candidate.name} 的考核报告</h1>
      {needsHumanReview ? (
        <section className="panel cut-panel">
          <h2>人工复核提示</h2>
          <p>系统检测到候选人在关卡评分中低于阈值或触发 Cut，需审核员确认最终结果。</p>
        </section>
      ) : null}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        <section className="panel">
          <h2>候选人基本信息</h2>
          <p>目标角色：{candidate.target_role ?? "-"}</p>
          <p>当前状态：{candidate.status}</p>
          <p>最终建议：{candidate.final_recommendation ?? "-"}</p>
          <p>当前模型：{candidate.selected_model ?? "-"}</p>
          <p>简历文件：{candidate.resume_file_name ?? "-"}</p>
          <p>关卡：{stages.map((stage) => `${stage.name}(${stage.status})`).join(" / ")}</p>
        </section>

        <section className="panel">
          <h2>AI 初步评分</h2>
          {evaluation ? (
            <>
              <div className="metric">{evaluation.average_score}</div>
              <p>
                建议：
                <span className={`badge ${evaluation.recommendation === "Cut" ? "cut" : evaluation.recommendation === "继续观察" ? "watch" : ""}`}>
                  {evaluation.recommendation}
                </span>
              </p>
              <p>{evaluation.reason_summary}</p>
              <div className="actions">
                {evaluation.risk_tags.map((risk) => (
                  <span className="badge watch" key={risk}>
                    {risk}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">候选人尚未提交最终方案。</p>
          )}
        </section>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start", marginTop: 18 }}>
        <section className="panel">
          <h2>DS 人物画像</h2>
          {candidate.persona_profile ? (
            <>
              <p>{candidate.persona_profile.summary}</p>
              <h3>优势</h3>
              <div className="actions">{candidate.persona_profile.strengths.map((item) => <span className="badge" key={item}>{item}</span>)}</div>
              <h3>风险</h3>
              <div className="actions">{candidate.persona_profile.risks.map((item) => <span className="badge watch" key={item}>{item}</span>)}</div>
            </>
          ) : (
            <p className="muted">尚未生成画像。</p>
          )}
        </section>
        <section className="panel">
          <h2>动态能力与 Agent 组合</h2>
          <AbilityPlanView plan={candidate.ability_plan} />
        </section>
      </div>

      {evaluation ? (
        <section className="panel" style={{ marginTop: 18 }}>
          <h2>五维评分与证据摘要</h2>
          <table className="table">
            <tbody>
              {Object.entries(evaluation.scores).map(([key, value]) => (
                <tr key={key}>
                  <th>{key}</th>
                  <td>{value} 分</td>
                </tr>
              ))}
            </tbody>
          </table>
          {evaluation.evidence_summary.map((item) => (
            <p key={item}>{item}</p>
          ))}
          {evaluation.human_review_result ? <p className="badge">人工复核：{evaluation.human_review_result}</p> : null}
        </section>
      ) : null}

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>逐轮维度评分</h2>
        <table className="table">
          <thead>
            <tr>
              <th>时间</th>
              <th>均分</th>
              <th>建议</th>
              <th>模型</th>
              <th>耗时/系数</th>
              <th>原因与下一问标准</th>
            </tr>
          </thead>
          <tbody>
            {turnScores.map((score) => (
              <tr key={score.id}>
                <td>{new Date(score.created_at).toLocaleString()}</td>
                <td>{score.average_score}</td>
                <td>{score.recommendation}</td>
                <td>{score.model_provider}</td>
                <td>
                  {score.elapsed_seconds != null ? `${Math.floor(score.elapsed_seconds / 60)}分${score.elapsed_seconds % 60}秒` : "-"}
                  <br />
                  <span className="muted">系数 {score.time_coefficient ?? "-"}</span>
                </td>
                <td>
                  {score.reason_summary}
                  <br />
                  <span className="muted">{score.next_question_standard}</span>
                  <div className="actions">
                    {Object.entries(score.scores).map(([key, value]) => (
                      <span className="badge" key={key}>{key}: {value}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start", marginTop: 18 }}>
        <section className="panel">
          <h2>全部对话记录</h2>
          <div className="chat">
            {messages.map((message) => (
              <div className={`message ${message.role}`} key={message.id}>
                <strong>{message.role === "ai" ? `AI ${message.ai_role ?? ""}` : "候选人"}</strong>
                {message.model_provider ? <span className="badge" style={{ marginLeft: 8 }}>{message.model_provider}</span> : null}
                <br />
                {message.content}
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>候选人 AI 思考工作区留档</h2>
          <div className="chat">
            {workspaceMessages.map((message) => (
              <div className={`message ${message.role === "model" ? "ai" : "candidate"}`} key={message.id}>
                <strong>{message.role === "model" ? "模型助手" : "候选人"}</strong>
                <span className="badge" style={{ marginLeft: 8 }}>{message.model_provider}</span>
                <br />
                {message.content}
              </div>
            ))}
            {workspaceMessages.length === 0 ? <p className="muted">暂无候选人自用模型对话。</p> : null}
          </div>
        </section>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr", alignItems: "start", marginTop: 18 }}>
        <section className="panel">
          <h2>关键事件时间线</h2>
          <div className="timeline">
            {events.map((event) => (
              <div className="event" key={event.id}>
                <div className="event-type">{event.event_type}</div>
                <div className="event-content">{new Date(event.created_at).toLocaleString()}</div>
                <div className="event-content">{event.ai_summary || event.raw_content}</div>
                {event.risk_tags?.length ? <span className="badge watch">{event.risk_tags.join("、")}</span> : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>最终方案</h2>
        <p className="message ai">{candidate.final_solution ?? "尚未提交"}</p>
        <h2>AI 使用说明</h2>
        <p className="message ai">{candidate.ai_usage_note ?? "尚未提交"}</p>
      </section>

      {evaluation ? <ReviewActions candidateId={candidate.id} /> : null}
    </div>
  );
}
