import BackLink from "@/app/components/BackLink";
import ReviewActions from "./ReviewActions";
import { getCandidateDetail } from "@/lib/repositories/candidates";
import { getFinalEvaluation, listTurnScores } from "@/lib/repositories/evaluations";
import { listEvents } from "@/lib/repositories/events";
import { listMessages, listWorkspaceMessages } from "@/lib/repositories/messages";
import { listStages } from "@/lib/repositories/stages";
import { buildStageRecords } from "@/lib/stageRecords";
import { formatChinaTime } from "@/lib/stageNames";

export const dynamic = "force-dynamic";

export default async function AdminCandidateDetailPage({ params }: { params: { id: string } }) {
  const candidate = await getCandidateDetail(params.id);
  if (!candidate) return <div className="container"><BackLink />候选人不存在</div>;

  const [stages, messages, workspaceMessages, eventLogs, turnScores, finalEvaluation] = await Promise.all([
    listStages(params.id),
    listMessages(params.id),
    listWorkspaceMessages(params.id),
    listEvents(params.id),
    listTurnScores(params.id),
    getFinalEvaluation(params.id)
  ]);
  const stageRecords = buildStageRecords({ stages, messages, workspaceMessages, eventLogs, turnScores });
  const persona = candidate.persona_profile;

  return (
    <div className="container">
      <BackLink />
      <h1 className="title">{candidate.name} 的考核档案</h1>

      <section className="panel">
        <div className="grid grid-3">
          <Info label="目标岗位" value={candidate.target_role ?? "-"} />
          <Info label="目标难度" value={candidate.target_difficulty ?? "-"} />
          <Info label="状态" value={candidate.status} />
          <Info label="简历文件" value={candidate.resume_file_name ?? "-"} />
          <Info label="面试官评价数" value={String(candidate.interviewer_evaluations?.length ?? 0)} />
          <Info label="最终建议" value={candidate.final_recommendation ?? "-"} />
        </div>
        {candidate.invite_url ? <p className="badge" style={{ marginTop: 12 }}>专属链接：{candidate.invite_url}</p> : null}
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>DeepSeek 人物画像</h2>
        {persona ? (
          <>
            <p>{persona.summary}</p>
            <p><strong>角色匹配：</strong>{persona.role_fit}</p>
            <div className="actions">{persona.strengths?.map((item: string) => <span className="badge" key={item}>{item}</span>)}</div>
            <div className="actions">{persona.risks?.map((item: string) => <span className="badge watch" key={item}>{item}</span>)}</div>
            <p className="muted">面试重点：{persona.interview_focus?.join("、")}</p>
          </>
        ) : <p className="muted">尚未生成人物画像。</p>}
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>面试官评价</h2>
        <table className="table">
          <thead><tr><th>轮次</th><th>面试官</th><th>阶段</th><th>建议</th><th>评价</th></tr></thead>
          <tbody>{candidate.interviewer_evaluations?.map((item: any) => (
            <tr key={item.id ?? item.round_no}>
              <td>{item.round_no}</td>
              <td>{item.interviewer_name}</td>
              <td>{item.interview_stage}</td>
              <td>{item.recommendation}</td>
              <td>{item.evaluation_text}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>分关卡过程证据</h2>
        <div className="stage-review-list">
          {stageRecords.map((record: any) => (
            <article className="card" key={record.stage.id}>
              <div className="actions" style={{ justifyContent: "space-between" }}>
                <h3>{record.stage.name}</h3>
                <span className="badge">{record.stage.status}</span>
              </div>
              <p className="muted">
                目标时长：{record.stage.target_duration_seconds ?? 0} 秒
                {record.stage.started_at ? ` / 开始：${formatChinaTime(record.stage.started_at)}` : ""}
              </p>

              <h4>AI 题目与追问</h4>
              {record.questions.length ? record.questions.map((question: any, index: number) => (
                <div className="message ai" key={question.id}>
                  <strong>题目 {index + 1}</strong><br />{question.content}
                </div>
              )) : <p className="muted">暂无 AI 题目。</p>}

              <h4>候选人回答与逐题评分</h4>
              {record.answers.length ? record.answers.map((item: any, index: number) => (
                <div className="message candidate" key={item.answer.id}>
                  <strong>回答 {index + 1}</strong><br />{item.answer.content}
                  {item.score ? (
                    <div className="score-block">
                      <strong>{item.score.average_score} 分 / {item.score.recommendation}</strong>
                      <p>{item.score.reason_summary}</p>
                      <table className="mini-table">
                        <tbody>{Object.entries(item.score.scores ?? {}).map(([key, value]) => <tr key={key}><td>{key}</td><td>{String(value)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  ) : <p className="muted">暂无本题评分。</p>}
                </div>
              )) : <p className="muted">暂无候选人正式回答。</p>}

              <h4>模型工作区留痕</h4>
              {record.workspaceMessages.length ? record.workspaceMessages.map((message: any) => (
                <div className={`message ${message.role === "candidate" ? "candidate" : "ai"}`} key={message.id}>
                  <strong>{message.role === "candidate" ? "候选人" : "模型助手"} / {message.model_provider}</strong><br />{message.content}
                </div>
              )) : <p className="muted">暂无模型工作区记录。</p>}

              <h4>关键事件</h4>
              {record.eventLogs.length ? record.eventLogs.map((event: any) => (
                <div className="event" key={event.id}>
                  <div className="event-type">{event.event_type}</div>
                  <div>{event.ai_summary ?? event.raw_content}</div>
                </div>
              )) : <p className="muted">暂无事件。</p>}
            </article>
          ))}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>简历文本</h2>
        <p className="message ai">{candidate.resume_text ?? "未上传"}</p>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>最终评分报告</h2>
        {finalEvaluation ? (
          <>
            <p><strong>{finalEvaluation.average_score} 分 / {finalEvaluation.recommendation}</strong></p>
            <p>{finalEvaluation.reason_summary}</p>
            <p className="muted">{finalEvaluation.evidence_summary?.join("；")}</p>
            <ReviewActions candidateId={candidate.id} />
          </>
        ) : <p className="muted">尚未生成最终报告。</p>}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><strong>{label}</strong><p>{value}</p></div>;
}
