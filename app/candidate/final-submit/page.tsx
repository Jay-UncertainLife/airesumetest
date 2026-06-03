"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FlowGuide from "@/app/components/FlowGuide";

export default function FinalSubmitPage() {
  const router = useRouter();
  const [finalSolution, setFinalSolution] = useState("");
  const [candidateFeedback, setCandidateFeedback] = useState("");
  const [readiness, setReadiness] = useState("正在检查能力关卡完成状态...");
  const [profileStatus, setProfileStatus] = useState("待最终确认后生成");
  const [canSubmit, setCanSubmit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const candidateId = localStorage.getItem("candidate_id");
    const token = localStorage.getItem("candidate_token");
    if (!candidateId || !token) {
      router.push("/candidate/login");
      return;
    }
    fetch(`/api/candidate/stage/current?candidate_id=${candidateId}`, { headers: { "x-candidate-token": token }, cache: "no-store" })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message ?? data.error ?? "读取候选人进度失败");
        const ready = canEnterFinalReview(data);
        const syncedDraft = buildAssessmentDraft(data);
        setFinalSolution((current) => current.trim() ? current : data.candidate?.final_solution?.trim() || syncedDraft);
        setCandidateFeedback((current) => current.trim() ? current : data.candidate?.ai_usage_note?.trim() || "");
        setCanSubmit(ready);
        setReadiness(ready ? "已同步候选人作答记录，可以在下方修改确认。" : "尚未进入审核复核，请先返回关卡页继续作答。");
      })
      .catch((err) => {
        setCanSubmit(false);
        setError(err instanceof Error ? err.message : "读取候选人进度失败");
      });
  }, [router]);

  async function submit() {
    const candidateId = localStorage.getItem("candidate_id");
    const token = localStorage.getItem("candidate_token");
    if (!candidateId || !token) {
      router.push("/candidate/login");
      return;
    }
    if (!window.confirm("确认提交最终审核复核信息吗？")) return;
    setLoading(true);
    setProfileStatus("正在调用 DeepSeek 生成最终人物画像...");
    setError("");
    const res = await fetch("/api/candidate/stage/final-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-candidate-token": token },
      body: JSON.stringify({ candidate_id: candidateId, candidate_token: token, final_solution: finalSolution, candidate_feedback: candidateFeedback })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.message ?? data.error ?? "最终提交失败");
      setProfileStatus("最终人物画像生成失败，请重试。");
      return;
    }
    setProfileStatus("最终人物画像已生成，候选人反馈已保存。");
    router.replace("/candidate/done");
  }

  return (
    <div className="container narrow">
      <FlowGuide active={5} />
      <section className="panel final-submit-panel">
        <h1 className="title">审核复核确认</h1>
        <p className="subtitle">{readiness}</p>
        <div className="panel">
          <h2>最终人物画像</h2>
          <p className="muted">{profileStatus}</p>
        </div>
        <div className="field">
          <label>作答记录确认</label>
          <textarea
            className="textarea answer-textarea"
            value={finalSolution}
            onChange={(event) => setFinalSolution(event.target.value)}
            disabled={!canSubmit || loading}
            placeholder="系统会同步本次关卡作答。你可以在这里补充或修改后确认。"
          />
        </div>
        <div className="field">
          <label>候选人最终反馈</label>
          <textarea
            className="textarea usage-textarea"
            value={candidateFeedback}
            onChange={(event) => setCandidateFeedback(event.target.value)}
            disabled={!canSubmit || loading}
            placeholder="可以写下你对本次考核、题目、AI 辅助或结果的反馈。"
          />
        </div>
        <button className="btn" onClick={submit} disabled={loading || !canSubmit || !finalSolution.trim()}>
          {loading ? "正在生成画像并保存反馈..." : "最终确认并提交"}
        </button>
        {error ? <p className="badge cut">{error}</p> : null}
      </section>
    </div>
  );
}

function canEnterFinalReview(data: any) {
  return (
    data.stage_key === "final" ||
    data.activeProgress?.current_state === "MANUAL_REVIEW_REQUIRED" ||
    data.progressRows?.some((row: any) => row.current_state === "MANUAL_REVIEW_REQUIRED" || row.current_state === "ABILITY_STAGE_COMPLETED")
  );
}

function buildAssessmentDraft(data: any) {
  const questions = (data.questions ?? []).filter((question: any) => ["basic", "ability"].includes(question.stage_key));
  if (!questions.length) return "";
  return questions.map((question: any, index: number) => {
    const answer = (data.answers ?? []).find((item: any) => item.question_id === question.question_id);
    const stageName = question.stage_key === "ability" ? "能力关卡" : "基础关卡";
    const sameStageQuestions = questions.filter((item: any) => item.stage_key === question.stage_key);
    const stageIndex = sameStageQuestions.findIndex((item: any) => item.question_id === question.question_id);
    const title = question.question_type === "followup" || stageIndex > 0 ? `追问题${stageIndex}` : "第一题";
    return `${stageName} / ${title}\n题目：${question.question_text}\n回答：${answer?.answer_text ?? ""}`;
  }).join("\n\n");
}
