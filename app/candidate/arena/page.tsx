"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FlowGuide from "@/app/components/FlowGuide";
import { buildArenaProgress } from "@/lib/arenaProgress";
import { stageCopy } from "@/lib/stages";
import { ABILITY_STAGE, BASIC_STAGE, PREP_STAGE, normalizeStageName } from "@/lib/stageNames";
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
  const [aiUsageNote, setAiUsageNote] = useState("");
  const [assistantInput, setAssistantInput] = useState("");
  const [modelProvider, setModelProvider] = useState<ModelProvider>("deepseek");
  const [loading, setLoading] = useState(false);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantLarge, setAssistantLarge] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());

  const localProgress = useMemo(() => (data ? buildArenaProgress(data) : null), [data]);
  const progress = data?.progress ?? localProgress;
  const currentStage = progress?.currentStage ?? undefined;
  const currentStageName = currentStage ? normalizeStageName(String(currentStage.name)) : PREP_STAGE;

  const stageMessages = useMemo(
    () => (currentStage ? data?.messages.filter((message) => message.stage_id === currentStage.id) ?? [] : []),
    [currentStage, data?.messages]
  );
  const stageScores = useMemo(
    () => (currentStage ? data?.turnScores.filter((score) => score.stage_id === currentStage.id) ?? [] : []),
    [currentStage, data?.turnScores]
  );
  const assistantMessages = useMemo(
    () => (currentStage ? data?.workspaceMessages.filter((message) => message.stage_id === currentStage.id) ?? [] : []),
    [currentStage, data?.workspaceMessages]
  );

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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!loading && !assistantLoading) return;
    const timer = window.setInterval(() => load(), 2500);
    return () => window.clearInterval(timer);
  }, [load, loading, assistantLoading]);

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

  async function startOrAdvanceStage() {
    if (!data) return;
    setLoading(true);
    setError("");
    setStatusMessage(currentStageName === PREP_STAGE ? "正在调用模型生成基础关卡首题，请不要关闭页面。" : "正在进入下一关并生成首题。");
    try {
      const result = await authedPost(`/api/candidates/${data.candidate.id}/stage/advance`, {});
      if (!result?.message?.content) throw new Error("后端未返回 AI 题目内容。");
      setData((current) => current && {
        ...current,
        stages: mergeById(current.stages, [result.stage].filter(Boolean)),
        messages: mergeById(current.messages, [result.message].filter(Boolean)),
        progress: result.progress ?? current.progress
      });
      await load();
      setStatusMessage(result.existing ? "已加载当前关卡题目。" : "关卡题目已生成并保存。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成关卡题目失败");
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer() {
    if (!answer.trim() || !data || !currentStage) return;
    setLoading(true);
    setError("");
    setStatusMessage("正在调用模型评分并生成追问，请不要关闭页面。");
    try {
      const result = await authedPost(`/api/candidates/${data.candidate.id}/messages`, {
        content: answer,
        ai_usage_note: aiUsageNote,
        model_provider: modelProvider
      });
      setAnswer("");
      setAiUsageNote("");
      setData((current) => current && {
        ...current,
        messages: mergeById(current.messages, [result.candidateMessage, result.aiMessage].filter(Boolean)),
        turnScores: mergeById(current.turnScores, [result.turnScore].filter(Boolean)),
        progress: result.progress ?? current.progress
      });
      await load();
      setStatusMessage(result.progress?.stageComplete ? "本关所需轮次已完成，可以进入下一步。" : "本轮评分和追问已生成。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交正式回应失败");
    } finally {
      setLoading(false);
    }
  }

  async function sendAssistantMessage() {
    if (!assistantInput.trim() || !data) return;
    const submitted = assistantInput;
    setAssistantLoading(true);
    setError("");
    setStatusMessage(`正在调用 ${modelProvider} 生成模型交互回复。`);
    setAssistantInput("");
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
      setData((current) => current && {
        ...current,
        workspaceMessages: mergeById(
          current.workspaceMessages.filter((message) => !message.id.startsWith("optimistic-")),
          [result.userMessage, result.modelMessage].filter(Boolean)
        )
      });
      await load();
      setStatusMessage("模型交互回复已生成并留痕。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "模型助手调用失败");
    } finally {
      setAssistantLoading(false);
    }
  }

  if (!data || !currentStage || !progress) return <div className="container">加载考核现场...</div>;

  const latestScore = stageScores[stageScores.length - 1];
  const activeStep = currentStageName === PREP_STAGE ? 2 : currentStageName === BASIC_STAGE ? 3 : 4;
  const elapsedSeconds = currentStage.started_at ? Math.max(0, Math.floor((nowMs - new Date(currentStage.started_at).getTime()) / 1000)) : 0;
  const targetSeconds = currentStage.target_duration_seconds ?? 0;
  const remainingSeconds = targetSeconds ? targetSeconds - elapsedSeconds : 0;
  const latestAiMessage = [...stageMessages].reverse().find((message) => message.role === "ai");
  const canStartQuestion = currentStageName === PREP_STAGE || (stageMessages.length === 0 && currentStageName !== ABILITY_STAGE);
  const answerDisabled = loading || !latestAiMessage || progress.stageComplete || data.candidate.status === "evaluated";

  return (
    <div className="container">
      <FlowGuide active={activeStep} />
      {error ? <p className="badge cut">{error}</p> : null}
      {statusMessage ? <p className="badge">{statusMessage}</p> : null}

      <div className="arena-grid candidate-stage-grid">
        <aside className="panel stage-side">
          <p className="badge">{data.candidate.target_role ?? "AI 产品经理"}</p>
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

          <div className="actions vertical-actions">
            {currentStageName === PREP_STAGE || stageMessages.length === 0 ? (
              <button className="btn secondary" onClick={startOrAdvanceStage} disabled={loading}>
                {loading ? "AI 正在生成题目..." : "进入第一题"}
              </button>
            ) : currentStageName === BASIC_STAGE ? (
              <button className="btn secondary" onClick={startOrAdvanceStage} disabled={loading || !progress.canAdvanceStage}>
                {progress.canAdvanceStage ? "进入能力关卡" : `完成 ${progress.requiredTurns} 轮后进入能力关卡`}
              </button>
            ) : (
              <button className="btn" onClick={() => router.push("/candidate/final-submit")} disabled={loading || !progress.canSubmitFinal}>
                {progress.canSubmitFinal ? "提交最终方案" : `完成 ${progress.requiredTurns} 轮后可提交最终方案`}
              </button>
            )}
          </div>
        </aside>

        <section className="panel answer-panel">
          <h2>AI 考核官对话区</h2>
          <div className="question-card">
            <strong>当前题目</strong>
            <p>{latestAiMessage?.content ?? "请点击左侧按钮生成正式题目。"}</p>
          </div>

          {stageMessages.length > 1 ? (
            <details className="history-box">
              <summary>查看本关历史对话</summary>
              <div className="chat">
                {stageMessages.map((message) => (
                  <div key={message.id} className={`message ${message.role}`}>
                    <strong>{message.role === "ai" ? "AI 考核官" : "候选人"}</strong><br />
                    {message.content}
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          <div className="field">
            <label>正式回答</label>
            <textarea
              className="textarea answer-textarea"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={answerDisabled}
              placeholder="请在这里输入你的正式作答。只有这里的内容会进入正式评分。"
            />
          </div>
          <div className="field">
            <label>AI 使用说明</label>
            <textarea
              className="textarea usage-textarea"
              value={aiUsageNote}
              onChange={(event) => setAiUsageNote(event.target.value)}
              disabled={answerDisabled}
              placeholder="说明是否使用 AI、使用了什么、采纳/否定/修改了哪些内容。"
            />
          </div>
          <button className="btn" onClick={submitAnswer} disabled={answerDisabled || !answer.trim()}>
            {loading ? "AI 正在评分并追问..." : progress.stageComplete ? "本关已完成" : "提交正式回答"}
          </button>
        </section>

        <aside className="panel score-side">
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
            )) : <p className="muted">提交正式回答后，系统会调用模型生成维度评分。</p>}
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
            {assistantMessages.map((message) => (
              <div key={message.id} className={`message ${message.role === "model" ? "ai" : "candidate"}`}>
                <strong>{message.role === "model" ? "模型助手" : "候选人"}</strong><br />
                {message.content}
              </div>
            ))}
            {assistantLoading ? <div className="message ai"><strong>模型助手</strong><br />正在等待 {modelProvider} 返回。</div> : null}
          </div>
          <textarea
            className="textarea"
            value={assistantInput}
            onChange={(event) => setAssistantInput(event.target.value)}
            placeholder="输入你的思考问题。模型助手会留痕，但不会自动写入正式回答。"
          />
          <button className="btn secondary" onClick={sendAssistantMessage} disabled={assistantLoading || !assistantInput.trim()}>
            {assistantLoading ? "模型思考中..." : `发送给 ${modelProvider}`}
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
