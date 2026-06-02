"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FlowGuide from "@/app/components/FlowGuide";
import { stageCopy } from "@/lib/stages";
import { Agent, Candidate, EventLog, Message, ModelProvider, Stage, TurnScore, WorkspaceMessage } from "@/lib/types";

type CandidateData = {
  candidate: Candidate;
  stages: Stage[];
  messages: Message[];
  workspaceMessages: WorkspaceMessage[];
  eventLogs: EventLog[];
  turnScores: TurnScore[];
  agents: Agent[];
};

export default function CandidateArenaPage() {
  const router = useRouter();
  const [data, setData] = useState<CandidateData | null>(null);
  const [answer, setAnswer] = useState("");
  const [workspaceInput, setWorkspaceInput] = useState("");
  const [modelProvider, setModelProvider] = useState<ModelProvider>("deepseek");
  const [loading, setLoading] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  const currentStage = useMemo(
    () => data?.stages.find((stage) => stage.status === "in_progress") ?? data?.stages[0],
    [data]
  );

  const load = useCallback(async () => {
    const candidateId = localStorage.getItem("candidate_id");
    if (!candidateId) {
      router.push("/candidate/login");
      return;
    }
    const res = await fetch(`/api/candidates/${candidateId}`);
    const next = await res.json();
    setData(next);
    setModelProvider(next.candidate.selected_model ?? "deepseek");
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function sendAnswer() {
    if (!answer.trim() || !data) return;
    setLoading(true);
    const res = await fetch(`/api/candidates/${data.candidate.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: answer, model_provider: modelProvider })
    });
    const result = await res.json();
    setAnswer("");
    if (result.autoSubmitted) {
      router.push("/candidate/done");
      return;
    }
    await load();
    setLoading(false);
  }

  async function advanceStage() {
    if (!data) return;
    setLoading(true);
    await fetch(`/api/candidates/${data.candidate.id}/stage/advance`, { method: "POST" });
    await load();
    setLoading(false);
  }

  async function switchModel(nextModel: ModelProvider) {
    if (!data) return;
    setModelProvider(nextModel);
    await fetch(`/api/candidates/${data.candidate.id}/model`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_provider: nextModel })
    });
    await load();
  }

  async function sendWorkspaceMessage() {
    if (!workspaceInput.trim() || !data) return;
    setWorkspaceLoading(true);
    await fetch(`/api/candidates/${data.candidate.id}/workspace-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: workspaceInput, model_provider: modelProvider })
    });
    setWorkspaceInput("");
    await load();
    setWorkspaceLoading(false);
  }

  if (!data || !currentStage) return <div className="container">加载考核现场...</div>;

  const stageMessages = data.messages.filter((message) => message.stage_id === currentStage.id);
  const workspaceMessages = data.workspaceMessages.filter((message) => !message.stage_id || message.stage_id === currentStage.id);
  const hasNextStage = data.stages.some((stage) => stage.status === "not_started");
  const activeStep = currentStage.name === "基础关卡" ? 3 : 4;
  const latestScore = data.turnScores[data.turnScores.length - 1];
  const showCutWarning = latestScore?.recommendation === "Cut";
  const elapsedSeconds = currentStage.started_at ? Math.max(0, Math.floor((nowMs - new Date(currentStage.started_at).getTime()) / 1000)) : 0;
  const targetSeconds = currentStage.target_duration_seconds ?? 0;
  const remainingSeconds = targetSeconds ? targetSeconds - elapsedSeconds : 0;
  const isOvertime = targetSeconds > 0 && remainingSeconds < 0;

  return (
    <div className="container">
      <FlowGuide active={activeStep} />
      {showCutWarning ? (
        <section className="panel cut-panel">
          <h2>触发 Cut / 人工复核</h2>
          <p>本轮得分 {latestScore.average_score} 分，低于阈值。系统已记录人工复核提示，审核员可在审核端查看。</p>
          <p className="muted">{latestScore.reason_summary}</p>
        </section>
      ) : null}

      <div className="arena-grid">
        <aside className="panel">
          <p className="badge">{data.candidate.target_role}</p>
          <h2>{currentStage.name}</h2>
          <p className="muted">{stageCopy[currentStage.name].goal}</p>
          {targetSeconds > 0 ? (
            <div className={`timer ${isOvertime ? "overtime" : ""}`}>
              <span>目标时长：{formatDuration(targetSeconds)}</span>
              <strong>{isOvertime ? `已超时 ${formatDuration(Math.abs(remainingSeconds))}` : `剩余 ${formatDuration(remainingSeconds)}`}</strong>
              <span>已用：{formatDuration(elapsedSeconds)}</span>
            </div>
          ) : null}
          <hr />
          <h2>本关 Agent / 模型</h2>
          <div className="timeline">
            {data.agents.map((agent) => (
              <div className="event" key={agent.id}>
                <div className="event-type">{agent.name}</div>
                <div className="event-content">{agent.agent_role}</div>
                <span className="badge">{agent.model_provider} / {agent.model_name}</span>
              </div>
            ))}
          </div>
          <h2>关键事件时间线</h2>
          <div className="timeline">
            {data.eventLogs.map((event) => (
              <div className="event" key={event.id}>
                <div className="event-type">{event.event_type}</div>
                <div className="event-content">{new Date(event.created_at).toLocaleString()}</div>
                <div className="event-content">{event.ai_summary || event.raw_content.slice(0, 90)}</div>
                {event.risk_tags?.length ? <div className="badge watch">{event.risk_tags.join("、")}</div> : null}
              </div>
            ))}
          </div>
          <div className="actions">
            {hasNextStage ? (
              <button className="btn secondary" onClick={advanceStage} disabled={loading}>
                进入能力关卡
              </button>
            ) : (
              <button className="btn" onClick={() => router.push("/candidate/final-submit")}>
                提交最终方案
              </button>
            )}
          </div>
        </aside>

        <section className="panel">
          <h2>AI 考核官对话区</h2>
          <div className="chat">
            {stageMessages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                <strong>{message.role === "ai" ? "AI 考核官" : "候选人"}</strong>
                {message.model_provider ? <span className="badge" style={{ marginLeft: 8 }}>{message.model_provider}</span> : null}
                <br />
                {message.content}
              </div>
            ))}
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <label>你的正式回应</label>
            <textarea
              className="textarea"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="请说明你的判断依据。模型工作区内容不会自动成为正式回答。"
            />
          </div>
          <button className="btn" onClick={sendAnswer} disabled={loading}>
            {loading ? "调用 DS 评分并生成追问..." : "提交正式回应"}
          </button>
        </section>

        <aside className="panel">
          <h2>模型交互工作区</h2>
          <p className="muted">可与 DS/OpenAI 交互辅助思考，完整留档。</p>
          <div className="field">
            <label>交互模型</label>
            <select className="select" value={modelProvider} onChange={(event) => switchModel(event.target.value as ModelProvider)}>
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div className="chat workspace-chat">
            {workspaceMessages.length ? workspaceMessages.map((message) => (
              <div key={message.id} className={`message ${message.role === "model" ? "ai" : "candidate"}`}>
                <strong>{message.role === "model" ? "模型助手" : "候选人"}</strong>
                <span className="badge" style={{ marginLeft: 8 }}>{message.model_provider}</span>
                <br />
                {message.content}
              </div>
            )) : <p className="muted">还没有模型交互记录。</p>}
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>向模型提问</label>
            <textarea
              className="textarea"
              value={workspaceInput}
              onChange={(event) => setWorkspaceInput(event.target.value)}
              placeholder="例如：帮我从 P01-P08 能力维度拆解这道题，但不要替我写最终答案。"
            />
          </div>
          <button className="btn secondary" onClick={sendWorkspaceMessage} disabled={workspaceLoading}>
            {workspaceLoading ? "模型思考中..." : `发送给 ${modelProvider === "openai" ? "OpenAI" : "DeepSeek"}`}
          </button>

          <h2>DS 维度评分表</h2>
          <div className="timeline">
            {data.turnScores.map((score) => (
              <div className="event" key={score.id}>
                <div className="event-type">{score.average_score} 分 · {score.recommendation}</div>
                <div className="event-content">{score.reason_summary}</div>
                <div className="event-content">下一问标准：{score.next_question_standard}</div>
                <table className="mini-table">
                  <tbody>
                    {Object.entries(score.scores).map(([key, value]) => (
                      <tr key={key}>
                        <td>{key}</td>
                        <td>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {score.risk_tags.length ? <span className="badge watch">{score.risk_tags.join("、")}</span> : null}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
