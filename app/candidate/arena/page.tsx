"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useRouter } from "next/navigation";
import FlowGuide from "@/app/components/FlowGuide";
import { ModelProvider } from "@/lib/types";

type StageCurrent = {
  candidate: { id: string; name: string; target_role?: string; selected_model?: ModelProvider; status: string };
  activeProgress?: {
    id: string;
    stage_key: "basic" | "ability" | "final";
    current_state: string;
    current_question_index?: number;
    current_dimension?: string;
    last_error?: string;
    score_status?: string;
  };
  stage_key: "basic" | "ability" | "final";
  stage_name: string;
  current_question?: {
    question_id: string;
    question_text: string;
    target_duration_seconds?: number;
    status: string;
  } | null;
  draft?: { draft_text?: string; ai_usage_note_draft?: string } | null;
  answer?: { answer_text?: string; ai_usage_note?: string } | null;
  latestScore?: { average_score?: number; score_status?: string; reason_summary?: string; risk_tags?: string[] } | null;
  questions: Array<{ question_id: string; stage_key: string; question_text: string; created_at: string; status: string }>;
  answers: Array<{ answer_id: string; question_id: string; answer_text?: string; ai_usage_note?: string; submitted_at: string }>;
  scores: Array<{ id: string; question_id?: string; average_score?: number; score_status?: string; reason_summary?: string; created_at: string }>;
  chatMessages: Array<{ message_id: string; role: "candidate" | "model"; content: string; created_at: string }>;
  timing: {
    elapsed_seconds: number;
    target_duration_seconds: number;
    remaining_seconds: number;
    is_overtime: boolean;
    should_auto_submit: boolean;
    timeout_level: string;
  };
  button: { label: string; action: string; disabled: boolean };
};

const stageGoal: Record<string, string> = {
  basic: "基础关卡会考察任务接收、信息整理、AI 使用留痕、变化响应和最终交付能力。",
  ability: "能力关卡会结合岗位要求，考察约束下取舍、证据链、风险控制和落地能力。",
  final: "最终评价用于提交最终方案，并生成更新后的候选人画像和评审报告。"
};

export default function CandidateArenaPage() {
  const router = useRouter();
  const [data, setData] = useState<StageCurrent | null>(null);
  const [answer, setAnswer] = useState("");
  const [aiUsageNote, setAiUsageNote] = useState("");
  const [assistantInput, setAssistantInput] = useState("");
  const [modelProvider, setModelProvider] = useState<ModelProvider>("deepseek");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantPos, setAssistantPos] = useState({ x: 24, y: 24 });
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const [lastLoadedMs, setLastLoadedMs] = useState(Date.now());
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const lastSavedRef = useRef("");
  const questionIdRef = useRef<string | null>(null);

  const activeStep = data?.stage_key === "ability" ? 4 : data?.stage_key === "final" ? 5 : 3;
  const isBusy = Boolean(loadingAction) || ["GENERATING_FIRST_QUESTION", "GENERATING_NEXT_QUESTION", "SUBMITTING_ANSWER", "SCORING"].includes(data?.activeProgress?.current_state ?? "");
  const canEdit = Boolean(data?.current_question) && !data?.answer && !isBusy && ["ANSWERING", "ANSWERING_OVERTIME"].includes(data?.activeProgress?.current_state ?? "");
  const stageQuestions = useMemo(() => data?.questions.filter((q) => q.stage_key === data.stage_key) ?? [], [data]);
  const effectiveTiming = useMemo(() => {
    if (!data) return null;
    if (!data.current_question || !["ANSWERING", "ANSWERING_OVERTIME"].includes(data.activeProgress?.current_state ?? "")) return data.timing;
    const deltaSeconds = Math.max(0, Math.floor((nowMs - lastLoadedMs) / 1000));
    const elapsed = data.timing.elapsed_seconds + deltaSeconds;
    const target = data.timing.target_duration_seconds;
    const remaining = target ? target - elapsed : 0;
    return {
      ...data.timing,
      elapsed_seconds: elapsed,
      remaining_seconds: remaining,
      is_overtime: target > 0 && elapsed > target,
      should_auto_submit: target > 0 && elapsed >= target * 2
    };
  }, [data, lastLoadedMs, nowMs]);

  const session = useCallback(() => {
    const candidateId = localStorage.getItem("candidate_id");
    const token = localStorage.getItem("candidate_token");
    if (!candidateId || !token) {
      router.push("/candidate/login");
      return null;
    }
    return { candidateId, token };
  }, [router]);

  const load = useCallback(async () => {
    const auth = session();
    if (!auth) return;
    const res = await fetch(`/api/candidate/stage/current?candidate_id=${auth.candidateId}`, {
      cache: "no-store",
      headers: { "x-candidate-token": auth.token }
    });
    const next = await res.json();
    if (!res.ok) {
      setError(next.message ?? next.error ?? "读取考核状态失败");
      return;
    }
    if (!isStageCurrent(next)) {
      setError("后端返回的考核状态结构不完整，请刷新页面重试。");
      return;
    }
    applyStageState(next);
    setModelProvider(next.candidate?.selected_model ?? "deepseek");
  }, [session]);

  function applyStageState(next: StageCurrent) {
    setData(next);
    setLastLoadedMs(Date.now());
    const nextQuestionId = next.current_question?.question_id ?? null;
    if (nextQuestionId !== questionIdRef.current) {
      questionIdRef.current = nextQuestionId;
      setAnswer(next.draft?.draft_text ?? next.answer?.answer_text ?? "");
      setAiUsageNote(next.draft?.ai_usage_note_draft ?? next.answer?.ai_usage_note ?? "");
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("assistant_dock_pos");
    if (saved) {
      try {
        setAssistantPos(JSON.parse(saved));
      } catch {
        // ignore stale layout data
      }
    }
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const shouldPoll = isBusy || ["GENERATION_FAILED", "SCORE_FAILED"].includes(data?.activeProgress?.current_state ?? "");
    if (!shouldPoll) return;
    const timer = window.setInterval(load, 3500);
    return () => window.clearInterval(timer);
  }, [data?.activeProgress?.current_state, isBusy, load]);

  useEffect(() => {
    if (!canEdit || !data?.current_question) return;
    const timer = window.setInterval(() => {
      const payload = `${data.current_question?.question_id}:${answer}:${aiUsageNote}`;
      if (payload === lastSavedRef.current) return;
      lastSavedRef.current = payload;
      void post("/api/candidate/stage/save-draft", {
        draft_text: answer,
        ai_usage_note_draft: aiUsageNote
      }, false);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [answer, aiUsageNote, canEdit, data?.current_question]);

  useEffect(() => {
    if (!canEdit || !effectiveTiming?.should_auto_submit) return;
    void submitAnswer("auto_timeout");
  }, [canEdit, effectiveTiming?.should_auto_submit]);

  async function post(path: string, body: Record<string, unknown>, reload = true) {
    const auth = session();
    if (!auth) throw new Error("缺少候选人登录态");
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-candidate-token": auth.token },
      body: JSON.stringify({
        ...body,
        candidate_id: auth.candidateId,
        candidate_token: auth.token,
        model_provider: modelProvider
      })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? json.error ?? "请求失败");
    if (reload) {
      if (isStageCurrent(json)) applyStageState(json);
      else await load();
    }
    return json;
  }

  async function runAction(action: string) {
    if (action === "done") {
      router.push("/candidate/done");
      return;
    }
    if (action === "final_submit") {
      router.push("/candidate/final-submit");
      return;
    }
    setLoadingAction(action);
    setError("");
    try {
      if (action === "start_first_question") {
        setData((current) => current ? {
          ...current,
          activeProgress: current.activeProgress ? { ...current.activeProgress, current_state: "GENERATING_FIRST_QUESTION" } : current.activeProgress,
          button: { label: "AI 正在生成题目，请稍候", action: "wait", disabled: true }
        } : current);
        await post("/api/candidate/stage/start-first-question", {});
      }
      if (action === "score_answer") await post("/api/candidate/stage/score-answer", {});
      if (action === "next_question") await post("/api/candidate/stage/next-question", {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoadingAction(null);
    }
  }

  async function submitAnswer(submitType: "manual" | "auto_timeout" = "manual") {
    if (!data?.current_question) return;
    setLoadingAction(submitType === "auto_timeout" ? "auto_submit" : "submit_answer");
    setError("");
    try {
      await post("/api/candidate/stage/submit-answer", {
        answer_text: answer,
        ai_usage_note: aiUsageNote,
        submit_type: submitType,
        client_submit_id: `${data.current_question.question_id}-${Date.now()}`
      });
      await post("/api/candidate/stage/score-answer", {});
      setAnswer("");
      setAiUsageNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交回答失败");
    } finally {
      setLoadingAction(null);
    }
  }

  async function sendAssistantMessage() {
    if (!assistantInput.trim()) return;
    const content = assistantInput.trim();
    setAssistantInput("");
    setAssistantLoading(true);
    setError("");
    try {
      await post("/api/candidate/assistant/chat", { content }, false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "辅助 AI 调用失败");
    } finally {
      setAssistantLoading(false);
    }
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    dragRef.current = { startX: event.clientX, startY: event.clientY, originX: assistantPos.x, originY: assistantPos.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const next = {
      x: Math.max(8, dragRef.current.originX + event.clientX - dragRef.current.startX),
      y: Math.max(8, dragRef.current.originY + event.clientY - dragRef.current.startY)
    };
    setAssistantPos(next);
    localStorage.setItem("assistant_dock_pos", JSON.stringify(next));
  }

  function endDrag() {
    dragRef.current = null;
  }

  if (!data) return <div className="container">正在恢复考核状态...</div>;

  return (
    <div className="container candidate-arena-shell">
      <FlowGuide active={activeStep} />
      <header className="stage-hero">
        <div>
          <p className="badge">{data.candidate.target_role ?? "AI 产品经理"}</p>
          <h1 className="title">{data.stage_name}</h1>
          <p className="subtitle">{stageGoal[data.stage_key]}</p>
        </div>
        <TimerBadge timing={effectiveTiming ?? data.timing} />
      </header>

      {error ? <p className="badge cut">{error}</p> : null}
      {data.activeProgress?.last_error ? <p className="badge cut">{data.activeProgress.last_error}</p> : null}

      <main className="stage-workspace">
        <section className="question-panel">
          <div className="stage-status-row">
            <span className="badge">第 {data.activeProgress?.current_question_index ?? 0} 题</span>
            <span className="badge">{stateLabel(data.activeProgress?.current_state)}</span>
            {data.latestScore ? <span className="badge">上一题得分 {data.latestScore.average_score}</span> : null}
          </div>
          <article className="question-card">
            <strong>当前题目</strong>
            <p>{data.current_question?.question_text ?? "点击下方按钮进入第一题，系统会实时调用模型生成题目。"}</p>
          </article>

          <div className="field">
            <label>正式回答</label>
            <textarea
              className="textarea answer-textarea stage-answer-textarea"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={!canEdit}
              placeholder="请在这里输入正式作答。只有这里的内容会进入评分。"
            />
          </div>
          <div className="field">
            <label>AI 使用说明</label>
            <textarea
              className="textarea usage-textarea"
              value={aiUsageNote}
              onChange={(event) => setAiUsageNote(event.target.value)}
              disabled={!canEdit}
              placeholder="说明是否使用 AI、使用了什么 AI、采纳/否定/修改了哪些内容。"
            />
          </div>

          <button
            className="btn stage-primary-action"
            disabled={Boolean(loadingAction) || data.button.disabled || (data.button.action === "submit_answer" && !answer.trim())}
            onClick={() => {
              const state = data.activeProgress?.current_state;
              if (data.button.action === "submit_answer") void submitAnswer("manual");
              else if (state === "INIT" || state === "GENERATION_FAILED") void runAction("start_first_question");
              else void runAction(data.button.action);
            }}
          >
            {loadingAction === "auto_submit" ? "已超时，系统正在自动提交" : loadingAction ? busyLabel(loadingAction) : data.button.label}
          </button>
        </section>

        <aside className="stage-evidence-panel">
          <h2>过程记录</h2>
          {stageQuestions.length ? stageQuestions.map((question, index) => {
            const score = data.scores.find((item) => item.question_id === question.question_id);
            const answerRecord = data.answers.find((item) => item.question_id === question.question_id);
            return (
              <article className={`session-card ${Number(score?.average_score ?? 100) < 60 ? "risk" : ""}`} key={question.question_id}>
                <strong>题目 {index + 1}</strong>
                <p>{question.question_text}</p>
                {answerRecord ? <p className="muted">已提交：{answerRecord.answer_text?.slice(0, 90)}</p> : <p className="muted">等待作答</p>}
                {score ? <span className="badge">{score.average_score} / {score.score_status}</span> : null}
              </article>
            );
          }) : <p className="muted">尚未生成题目。</p>}
        </aside>
      </main>

      <button className="assistant-launcher" onClick={() => setAssistantOpen(true)}>AI 小助手</button>
      {assistantOpen ? (
        <section className="assistant-dock floating-assistant" style={{ right: assistantPos.x, bottom: assistantPos.y }}>
          <div className="assistant-head" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag}>
            <strong>辅助 AI 对话</strong>
            <button className="icon-button" onClick={() => setAssistantOpen(false)} type="button">×</button>
          </div>
          <div className="chat workspace-chat assistant-chat">
            {data.chatMessages.map((message) => (
              <div key={message.message_id} className={`message ${message.role === "model" ? "ai" : "candidate"}`}>
                <strong>{message.role === "model" ? "模型助手" : "候选人"}</strong><br />
                {message.content}
              </div>
            ))}
            {assistantLoading ? <div className="message ai"><strong>模型助手</strong><br />正在生成回复。</div> : null}
          </div>
          <textarea className="textarea" value={assistantInput} onChange={(event) => setAssistantInput(event.target.value)} placeholder="辅助思考，不会自动写入正式答案。" />
          <button className="btn secondary" onClick={sendAssistantMessage} disabled={assistantLoading || !assistantInput.trim()}>发送</button>
        </section>
      ) : null}
    </div>
  );
}

function TimerBadge({ timing }: { timing: StageCurrent["timing"] }) {
  return (
    <div className={`timer stage-timer ${timing.is_overtime ? "overtime" : ""}`}>
      <span>目标：{formatDuration(timing.target_duration_seconds)}</span>
      <strong>{timing.is_overtime ? `已超时 ${formatDuration(Math.abs(timing.remaining_seconds))}` : `剩余 ${formatDuration(Math.max(timing.remaining_seconds, 0))}`}</strong>
      <span>已用：{formatDuration(timing.elapsed_seconds)}</span>
    </div>
  );
}

function formatDuration(seconds: number) {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.max(0, seconds) % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function stateLabel(state?: string) {
  const labels: Record<string, string> = {
    INIT: "等待开始",
    GENERATING_FIRST_QUESTION: "生成首题中",
    GENERATING_NEXT_QUESTION: "生成下一题中",
    ANSWERING: "作答中",
    ANSWERING_OVERTIME: "已超时",
    SUBMITTING_ANSWER: "提交中",
    SCORING: "评分中",
    WAITING_NEXT_ACTION: "等待下一题",
    BASIC_STAGE_COMPLETED: "基础关卡完成",
    ABILITY_STAGE_COMPLETED: "能力关卡完成",
    GENERATION_FAILED: "生成失败",
    SCORE_FAILED: "评分失败"
  };
  return state ? labels[state] ?? state : "未开始";
}

function busyLabel(action: string) {
  if (action === "start_first_question" || action === "next_question") return "AI 正在生成题目，请稍候";
  if (action === "submit_answer") return "正在提交回答";
  if (action === "score_answer") return "AI 正在评分，请稍候";
  return "处理中";
}

function isStageCurrent(value: unknown): value is StageCurrent {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<StageCurrent>;
  return Boolean(
    data.candidate &&
    typeof data.stage_key === "string" &&
    data.timing &&
    data.button &&
    Array.isArray(data.questions) &&
    Array.isArray(data.answers) &&
    Array.isArray(data.scores) &&
    Array.isArray(data.chatMessages)
  );
}
