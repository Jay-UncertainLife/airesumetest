"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FlowGuide from "@/app/components/FlowGuide";
import { stageCopy } from "@/lib/stages";
import { normalizeStageName, stageRank } from "@/lib/stageNames";
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
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [assistantLarge, setAssistantLarge] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());

  const currentStage = useMemo(() => {
    if (!data) return undefined;
    const stageIdsWithAiQuestions = new Set(data.messages.filter((message) => message.role === "ai").map((message) => message.stage_id));
    const stagesWithQuestions = data.stages.filter((stage) => stageIdsWithAiQuestions.has(stage.id));
    if (stagesWithQuestions.length) return stagesWithQuestions.sort((a, b) => stageRank(b.name) - stageRank(a.name))[0];
    const activeStages = data.stages.filter((stage) => stage.status === "in_progress");
    return activeStages.sort((a, b) => stageRank(b.name) - stageRank(a.name))[0];
  }, [data]);

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
    if (!answer.trim() || !data) return;
    setLoading(true);
    setError("");
    setStatusMessage("正在调用模型评分并生成下一轮追问，请稍候。");
    try {
      const result = await authedPost(`/api/candidates/${data.candidate.id}/messages`, { content: answer, model_provider: modelProvider });
      setAnswer("");
      if (result.autoSubmitted) {
        router.push("/candidate/done");
        return;
      }
      await load();
      setStatusMessage("本轮评分和追问已生成。");
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
    setStatusMessage("正在调用 DeepSeek/OpenAI 生成关卡首题。模型返回前请不要关闭页面。");
    try {
      const result = await authedPost(`/api/candidates/${data.candidate.id}/stage/advance`, {});
      if (!result?.message?.content) {
        throw new Error("后端请求完成，但没有返回 AI 首题内容。请检查模型调用日志。");
      }
      setData((current) => {
        if (!current) return current;
        const nextStages = current.stages.map((stage) => (stage.id === result.stage.id ? result.stage : stage));
        const hasMessage = current.messages.some((message) => message.id === result.message.id);
        return {
          ...current,
          stages: nextStages,
          messages: hasMessage ? current.messages : [...current.messages, result.message]
        };
      });
      await load();
      setStatusMessage(result.existing ? "已加载已有关卡首题。" : "关卡首题已生成。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成关卡首题失败");
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
    setData({
      ...data,
      workspaceMessages: [
        ...data.workspaceMessages,
        {
          id: `optimistic-${Date.now()}`,
          candidate_id: data.candidate.id,
          stage_id: currentStage?.id,
          role: "candidate",
          model_provider: modelProvider,
          content: submitted,
          created_at: new Date().toISOString()
        }
      ]
    });
    try {
      const result = await authedPost(`/api/candidates/${data.candidate.id}/workspace-chat`, {
        content: submitted,
        model_provider: modelProvider
      });
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          workspaceMessages: current.workspaceMessages
            .filter((message) => !message.id.startsWith("optimistic-"))
            .concat([result.userMessage, result.modelMessage].filter(Boolean))
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

  if (!data || !currentStage) return <div className="container">加载考核现场...</div>;

  const stageMessages = data.messages.filter((message) => message.stage_id === currentStage.id);
  const workspaceMessages = data.workspaceMessages;
  const hasNextStage = data.stages.some((stage) => stage.status === "not_started");
  const normalizedCurrentStageName = normalizeStageName(String(currentStage.name));
  const isPrepStage = normalizedCurrentStageName === "面试关卡准备";
  const activeStep = isPrepStage ? 2 : normalizedCurrentStageName === "基础关卡" ? 3 : 4;
  const latestScore = data.turnScores[data.turnScores.length - 1];
  const elapsedSeconds = currentStage.started_at ? Math.max(0, Math.floor((nowMs - new Date(currentStage.started_at).getTime()) / 1000)) : 0;
  const targetSeconds = currentStage.target_duration_seconds ?? 0;
  const remainingSeconds = targetSeconds ? targetSeconds - elapsedSeconds : 0;

  return (
    <div className="container">
      <FlowGuide active={activeStep} />
      {error ? <p className="badge cut">{error}</p> : null}
      {statusMessage ? <p className="badge">{statusMessage}</p> : null}
      {latestScore?.recommendation === "Cut" ? (
        <section className="panel cut-panel">
          <h2>触发 Cut / 人工复核</h2>
          <p>本轮得分 {latestScore.average_score}，系统已记录人工复核提示。</p>
          <p className="muted">{latestScore.reason_summary}</p>
        </section>
      ) : null}

      <div className="arena-grid arena-grid-main">
        <aside className="panel">
          <p className="badge">{data.candidate.target_role}</p>
          <h2>{normalizedCurrentStageName}</h2>
          <p className="muted">{stageCopy[normalizedCurrentStageName]?.goal ?? "AI 考核官将根据候选人画像、岗位难度和能力维度生成本关问题。"}</p>
          {targetSeconds > 0 ? (
            <div className={`timer ${remainingSeconds < 0 ? "overtime" : ""}`}>
              <span>目标时长：{formatDuration(targetSeconds)}</span>
              <strong>{remainingSeconds < 0 ? `已超时 ${formatDuration(Math.abs(remainingSeconds))}` : `剩余 ${formatDuration(remainingSeconds)}`}</strong>
              <span>已用：{formatDuration(elapsedSeconds)}</span>
            </div>
          ) : null}

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
            {hasNextStage ? (
              <button className="btn secondary" onClick={advanceStage} disabled={loading}>
                {loading ? "模型正在生成题目..." : isPrepStage ? "生成基础关卡首题" : "进入下一关"}
              </button>
            ) : (
              <button className="btn" onClick={() => router.push("/candidate/final-submit")}>提交最终方案</button>
            )}
          </div>
        </aside>

        <section className="panel">
          <h2>AI 考核官对话区</h2>
          <div className="chat">
            {stageMessages.length === 0 ? (
              <div className="message ai">
                <strong>AI 考核官</strong><br />
                {loading
                  ? "正在等待模型生成题目，请不要关闭页面。"
                  : isPrepStage
                    ? "当前仍在面试关卡准备。请点击左侧“生成基础关卡首题”，系统会调用模型生成正式题目。"
                    : "本关尚未生成首题。请点击左侧按钮触发 AI 出题。"}
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
            <textarea className="textarea" value={answer} onChange={(event) => setAnswer(event.target.value)} />
          </div>
          <button className="btn" onClick={sendAnswer} disabled={loading || stageMessages.length === 0}>
            {loading ? "正在调用模型评分并追问..." : "提交正式回应"}
          </button>
        </section>

        <aside className="panel">
          <h2>维度评分表</h2>
          <div className="timeline">
            {data.turnScores.map((score) => (
              <div className="event" key={score.id}>
                <div className="event-type">{score.average_score} 分 / {score.recommendation}</div>
                <div>{score.reason_summary}</div>
                <table className="mini-table">
                  <tbody>
                    {Object.entries(score.scores).map(([key, value]) => (
                      <tr key={key}><td>{key}</td><td>{value}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
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
            {workspaceMessages.map((message) => (
              <div key={message.id} className={`message ${message.role === "model" ? "ai" : "candidate"}`}>
                <strong>{message.role === "model" ? "模型助手" : "候选人"}</strong><br />
                {message.content}
              </div>
            ))}
            {workspaceLoading ? (
              <div className="message ai">
                <strong>模型助手</strong><br />
                已收到问题，正在等待 {modelProvider} 返回。
              </div>
            ) : null}
          </div>
          <textarea
            className="textarea"
            value={workspaceInput}
            onChange={(event) => setWorkspaceInput(event.target.value)}
            placeholder="输入你的思考问题，系统会调用后端配置的大模型并留痕。"
          />
          <button className="btn secondary" onClick={sendWorkspaceMessage} disabled={workspaceLoading}>
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
    agents: next.agents.length ? next.agents : current.agents
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
