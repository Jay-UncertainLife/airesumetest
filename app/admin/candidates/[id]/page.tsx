import BackLink from "@/app/components/BackLink";
import ReviewActions from "./ReviewActions";

export const dynamic = "force-dynamic";

async function getDetail(id: string) {
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/admin/candidates/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function AdminCandidateDetailPage({ params }: { params: { id: string } }) {
  const data = await getDetail(params.id);
  if (!data?.candidate) return <div className="container"><BackLink />候选人不存在</div>;
  const { candidate, stages, messages, workspaceMessages, eventLogs, turnScores, finalEvaluation } = data;
  const persona = candidate.persona_profile;

  return (
    <div className="container">
      <BackLink />
      <h1 className="title">{candidate.name} 的考核档案</h1>
      <section className="panel">
        <div className="grid grid-3">
          <div><strong>目标岗位</strong><p>{candidate.target_role ?? "-"}</p></div>
          <div><strong>目标难度</strong><p>{candidate.target_difficulty ?? "-"}</p></div>
          <div><strong>状态</strong><p>{candidate.status}</p></div>
          <div><strong>简历文件</strong><p>{candidate.resume_file_name ?? "-"}</p></div>
          <div><strong>面试官评价数量</strong><p>{candidate.interviewer_evaluations?.length ?? 0}</p></div>
          <div><strong>最终建议</strong><p>{candidate.final_recommendation ?? "-"}</p></div>
        </div>
        {candidate.invite_url ? (
          <p className="badge" style={{ marginTop: 12 }}>专属链接：{candidate.invite_url}</p>
        ) : null}
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
        ) : <p className="muted">尚未生成画像。</p>}
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>面试官评价</h2>
        <table className="table">
          <thead><tr><th>轮次</th><th>面试官</th><th>阶段</th><th>建议</th><th>评价</th></tr></thead>
          <tbody>{candidate.interviewer_evaluations?.map((item: any) => (
            <tr key={item.id ?? item.round_no}><td>{item.round_no}</td><td>{item.interviewer_name}</td><td>{item.interview_stage}</td><td>{item.recommendation}</td><td>{item.evaluation_text}</td></tr>
          ))}</tbody>
        </table>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>简历文本</h2>
        <p className="message ai">{candidate.resume_text ?? "未上传"}</p>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>逐轮评分</h2>
        <table className="table">
          <thead><tr><th>时间</th><th>分数</th><th>建议</th><th>模型</th><th>说明</th></tr></thead>
          <tbody>{turnScores.map((score: any) => (
            <tr key={score.id}><td>{new Date(score.created_at).toLocaleString()}</td><td>{score.average_score}</td><td>{score.recommendation}</td><td>{score.model_provider}</td><td>{score.reason_summary}</td></tr>
          ))}</tbody>
        </table>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>正式对话记录</h2>
        {messages.map((message: any) => <div className={`message ${message.role === "candidate" ? "candidate" : "ai"}`} key={message.id}>{message.content}</div>)}
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>模型工作区留痕</h2>
        {workspaceMessages.map((message: any) => <div className={`message ${message.role === "candidate" ? "candidate" : "ai"}`} key={message.id}>{message.model_provider}: {message.content}</div>)}
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>关键事件</h2>
        {eventLogs.map((event: any) => <div className="event" key={event.id}><div className="event-type">{event.event_type}</div><div>{event.ai_summary ?? event.raw_content}</div></div>)}
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>最终评分报告</h2>
        {finalEvaluation ? (
          <>
            <p><strong>{finalEvaluation.average_score} 分 · {finalEvaluation.recommendation}</strong></p>
            <p>{finalEvaluation.reason_summary}</p>
            <p className="muted">{finalEvaluation.evidence_summary?.join("；")}</p>
            <ReviewActions candidateId={candidate.id} />
          </>
        ) : <p className="muted">尚未生成最终报告。</p>}
      </section>
    </div>
  );
}
