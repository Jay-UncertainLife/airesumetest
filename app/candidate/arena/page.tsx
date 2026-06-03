"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FlowGuide from "@/app/components/FlowGuide";
import { buildArenaProgress } from "@/lib/arenaProgress";
import { stageCopy } from "@/lib/stages";
import { normalizeStageName, stageRank } from "@/lib/stageNames";
import { Agent, Candidate, EventLog, Message, ModelProvider, Stage, TurnScore, WorkspaceMessage } from "@/lib/types";

type ArenaProgress = ReturnType<typeof buildArenaProgress>;

type CandidateData = {
  candidate: Candidate;
  stages: Stage[];
  messages: Message[];
  workspaceMessages: WorkspaceMessage[];
  eventLogs: EventLog[];
  turnScores: TurnScore[];
  agents: Agent[];
  progress?: ArenaProgress;
};

export default function CandidateArenaPage() {
  const router = useRouter();
  const [data, setData] = useState<CandidateData | null>(null);
  const [answer, setAnswer] = useState("");
  const [workspaceInput, setWorkspaceInput] = useState("");
  const [modelProvider, setModelProvider] = useState<ModelProvider>("deepseek");
  const [loading, setLoading] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [assistantLarge, setAssistantLarge] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());

  const localProgress = useMemo(() => data ? buildArenaProgress(data) : null, [data]);
  const progress = data?.progress ?? localProgress;
  const currentStage = progress?.currentStage ?? undefined;
  const currentStageName = currentStage ? normalizeStageName(String(currentStage.name)) : "面试关卡准备";

  const auth = useCallback(() => {
    const candidateId = localStorage.getItem("candidate_id");
    const token = localStorage.getItem("candidate_token");
    if (!candidateId || !token) {
      router.push("/candidate/login");
      return null;
    }
    return { candidateId, token };
  }, [router]);

  const load = useCallback(async () => {
    const session = auth();
    if (!session) return;
    const res = await fetch(`/api/candidates/${session.candidateId}`, {
      cache: "no-store",
      headers: { "x-candidate-token": session.token }
    });
    const next = await res.json();
    if (!res.ok) {
      setError(next.message ?? next.error ?? "读取考核数据失败");
      return;
    }
    setData((current) => mergeCandidateData(current, next));
    setModelProvider(next.candidate.selected_model ?? "deepseek");
  }, [auth]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!loading && !workspaceLoading) return;
    const timer = window.setInterval(() => load(), 2500);
    return () => window.clearInterval(timer);
  }, [load, loading, workspaceLoading]);

  async function authedPost(path: string, body: Record<string, unknown>) {
    const session = auth();
    if (!session) throw new Error("缺少候选人登录态");
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-candidate-token": session.token },
      body: JSON.stringify({ ...body, candidate_token: session.token })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? json.error ?? "请求失败");
    return json;
  }

  async function sendAnswer() {
    if (!answer.trim() || !data || !currentStage) return;
    setLoading(true);
    setError("");
    setStatusMessage("正在调用模型评分并生成下一轮追问，请稍候。");
    try {
      const submitted = answer;
      const result = await authedPost(`/api/candidates/${data.candidate.id}/messages`, { content: submitted, model_provider: modelProvider });
      setAnswer("");
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          messages: mergeById(current.messages, [result.candidateMessage, result.aiMessage].filter(Boolean)),
          turnScores: mergeById(current.turnScores, [result.turnScore].filter(Boolean)),
          progress: result.progress ?? current.progress
        };
      });
      await load();
      setStatusMessage(result.progress?.stageComplete ? "本关轮次已完成，可以进入下一步。" : "本轮评分和追问已生成。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交正式回应失败");
    } finally {
      setLoading(false);
    }
  }

  async function advanceStage() {
    if (!data) return;
    setLoading(true);
    setError("");
    setStatusMessage(currentStageName === "面试关卡准备" ? "正在生成基础关卡首题。" : "正在进入能力关卡并生成首题。");
    try {
      const result = await authedPost(`/api/candidates/${data.candidate.id}/stage/advance`, {});
      if (!result?.message?.content) throw new Error("后端未返回 AI 题目内容。");
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          stages: mergeById(current.stages, [result.stage].filter(Boolean)),
          messages: mergeById(current.messages, [result.message].filter(Boolean)),
          progress: result.progress ?? current.progress
        };
      });
      await load();
      setStatusMessage(result.existing ? "已加载已有题目。" : "关卡首题已生成。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成关卡题目失败");
    } finally {
      setLoading(false);
    }
  }

  async function sendWorkspaceMessage() {
    if (!workspaceInput.trim() || !data) return;
    const submitted = workspaceInput;
    setWorkspaceLoading(true);
    setError("");
    setStatusMessage(`正在调用 ${modelProvider} 生成模型交互回复。`);
    setWorkspaceInput("");
    const optimistic: WorkspaceMessage = {
      id: `optimistic-${Date.now()}`,
      candidate_id: data.candidate.id,
      stage_id: currentStage?.id,
      role: "candidate",
      model_provider: modelProvider,
      content: submitted,
      created_at: new Date().toISOString()
    };
    setData({ ...data, workspaceMessages: mergeById(data.workspaceMessages, [optimistic]) });
    try {
      const result = await authedPost(`/api/candidates/${data.candidate.id}/workspace-chat`, { content: submitted, model_provider: modelProvider });
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          workspaceMessages: mergeById(
            current.workspaceMessages.filter((message) => !message.id.startsWith("optimistic-")),
            [result.userMessage, result.modelMessage].filter(Boolean)
          )
        };
      });
      await load();
      setStatusMessage("模型交互回复已生成。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "模型工作区调用失败");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  if (!data || !currentStage || !progress) return <div className="container">加载考核现场...</div>;

  const stageMessages = data.messages.filter((message) => message.stage_id === currentStage.id);
  const stageScores = data.turnScores.filter((score) => score.stage_id === currentStage.id);
  const latestScore = stageScores[stageScores.length - 1];
  const activeStep = currentStageName === "面试关卡准备" ? 2 : currentStageName === "基础关卡" ? 3 : 4;
  const elapsedSeconds = currentStage.started_at ? Math.max(0, Math.floor((nowMs - new Date(currentStage.started_at).getTime()) / 1000)) : 0;
  const targetSeconds = currentStage.target_duration_seconds ?? 0;
  const remainingSeconds = targetSeconds ? targetSeconds - elapsedSeconds : 0;
  const canStartBasic = currentStageName === "面试关卡准备";
  const canGoAbility = progress.canAdvanceStage;
  const canSubmitFinal = progress.canSubmitFinal;
  const answerDisabled = loading || stageMessages.length === 0 || progress.stageComplete || data.candidate.status === "evaluated";

  return (
    <div className="container">
      <FlowGuide active={activeStep} />
      {error ? <p className="badge cut">{error}</p> : null}
      {statusMessage ? <p className="badge">{statusMessage}</p> : null}

      <div className="arena-grid arena-grid-main">
        <aside className="panel">
          <p className="badge">{data.candidate.target_role}</p>
          <h2>{currentStageName}</h2>
          <p className="muted">{stageCopy[currentStageName]?.goal}</p>
          {targetSeconds > 0 ? (
            <div className={`timer ${remainingSeconds < 0 ? "overtime" : ""}`}>
              <span>目标时长：{formatDuration(targetSeconds)}</span>
              <strong>{remainingSeconds < 0 ? `已超时 ${formatDuration(Math.abs(remainingSeconds))}` : `剩余 ${formatDuration(remainingSeconds)}`}</strong>
              <span>已用：{formatDuration(elapsedSeconds)}</span>
            </div>
          ) : null}
          <p className="badge">本关进度：{progress.answeredTurns}/{progress.requiredTurns} 轮</p>
          {latestScore ? <p className="badge">最新得分：{latestScore.average_score} / {latestScore.recommendation}</p> : null}

          <h2>Agent</h2>
          <div className="timeline">
            {data.agents.map((agent) => (
              <div className="event" key={agent.id}>
                <div className="event-type">{agent.name}</div>
                <span className="badge">{agent.model_provider} / {agent.model_name}</span>
              </div>
            ))}
          </div>

          <h2>关键事件</h2>
          <div className="timeline">
            {data.eventLogs.map((event) => (
              <div className="event" key={event.id}>
                <div className="event-type">{event.event_type}</div>
                <div>{event.ai_summary || event.raw_content.slice(0, 100)}</div>
              </div>
            ))}
          </div>

          <div className="actions">
            {canStartBasic ? (
              <button className="btn secondary" onClick={advanceStage} disabled={loading}>生成基础关卡首题</button>
            ) : currentStageName === "基础关卡" ? (
              <button className="btn secondary" onClick={advanceStage} disabled={loading || !canGoAbility}>
                {canGoAbility ? "进入能力关卡" : `完成 ${progress.requiredTurns} 轮后进入能力关`}
              </button>
            ) : (
              <button className="btn" onClick={() => router.push("/candidate/final-submit")} disabled={!canSubmitFinal || loading}>
                {canSubmitFinal ? "提交最终方案" : `完成 ${progress.requiredTurns} 轮后可提交`}
              </button>
            )}
          </div>
        </aside>

        <section className="panel">
          <h2>AI 考核官对话区</h2>
          <div className="chat">
            {stageMessages.length === 0 ? (
              <div className="message ai">
                <strong>AI 考核官</strong><br />
                {canStartBasic ? "请点击左侧“生成基础关卡首题”。" : "本关尚未生成题目，请点击左侧按钮。"}
              </div>
            ) : null}
            {stageMessages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                <strong>{message.role === "ai" ? "AI 考核官" : "候选人"}</strong><br />
                {message.content}
              </div>
            ))}
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <label>正式回应</label>
            <textarea className="textarea" value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={answerDisabled} />
          </div>
          <button className="btn" onClick={sendAnswer} disabled={answerDisabled || !answer.trim()}>
            {loading ? "正在调用模型评分并追问..." : progress.stageComplete ? "本关已完成" : "提交正式回应"}
          </button>
        </section>

        <aside className="panel">
          <h2>维度评分表</h2>
          <div className="timeline">
            {stageScores.length ? stageScores.map((score, index) => (
              <div className="event" key={score.id}>
                <div className="event-type">第 {index + 1} 轮：{score.average_score} 分 / {score.recommendation}</div>
                <div>{score.reason_summary}</div>
                <table className="mini-table">
                  <tbody>
                    {Object.entries(score.scores).map(([key, value]) => (
                      <tr key={key}><td>{key}</td><td>{value}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )) : <p className="muted">提交正式回应后，系统会调用模型生成维度评分。</p>}
          </div>
        </aside>
      </div>

      <button className="assistant-launcher" onClick={() => setAssistantOpen(true)}>AI 小助手</button>
      {assistantOpen ? (
        <section className={`assistant-dock ${assistantLarge ? "large" : ""}`}>
          <div className="assistant-head">
            <strong>模型交互小助手</strong>
            <div className="actions">
              <button className="btn secondary" onClick={() => setAssistantLarge((value) => !value)}>{assistantLarge ? "缩小" : "放大"}</button>
              <button className="btn secondary" onClick={() => setAssistantOpen(false)}>关闭</button>
            </div>
          </div>
          <div className="field">
            <label>模型</label>
            <select className="select" value={modelProvider} onChange={(event) => setModelProvider(event.target.value as ModelProvider)}>
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div className="chat workspace-chat assistant-chat">
            {data.workspaceMessages.map((message) => (
              <div key={message.id} className={`message ${message.role === "model" ? "ai" : "candidate"}`}>
                <strong>{message.role === "model" ? "模型助手" : "候选人"}</strong><br />
                {message.content}
              </div>
            ))}
            {workspaceLoading ? <div className="message ai"><strong>模型助手</strong><br />正在等待 {modelProvider} 返回。</div> : null}
          </div>
          <textarea className="textarea" value={workspaceInput} onChange={(event) => setWorkspaceInput(event.target.value)} placeholder="输入你的思考问题，系统会调用后端配置的大模型并留痕。" />
          <button className="btn secondary" onClick={sendWorkspaceMessage} disabled={workspaceLoading || !workspaceInput.trim()}>
            {workspaceLoading ? "模型思考中..." : `发送给 ${modelProvider}`}
          </button>
        </section>
      ) : null}
    </div>
  );
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function mergeCandidateData(current: CandidateData | null, next: CandidateData): CandidateData {
  if (!current || current.candidate.id !== next.candidate.id) return next;
  return {
    ...next,
    stages: mergeById(current.stages, next.stages),
    messages: mergeById(current.messages, next.messages),
    workspaceMessages: mergeById(current.workspaceMessages, next.workspaceMessages),
    eventLogs: mergeById(current.eventLogs, next.eventLogs),
    turnScores: mergeById(current.turnScores, next.turnScores),
    agents: next.agents.length ? next.agents : current.agents,
    progress: next.progress ?? current.progress
  };
}

function mergeById<T extends { id: string; created_at?: string }>(previous: T[], incoming: T[]) {
  const merged = new Map<string, T>();
  for (const item of previous) merged.set(item.id, item);
  for (const item of incoming) merged.set(item.id, item);
  return Array.from(merged.values()).sort((a, b) => {
    const left = a.created_at ? new Date(a.created_at).getTime() : 0;
    const right = b.created_at ? new Date(b.created_at).getTime() : 0;
    return left - right;
  });
}
