"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FlowGuide from "@/app/components/FlowGuide";

export default function FinalSubmitPage() {
  const router = useRouter();
  const [finalSolution, setFinalSolution] = useState("");
  const [aiUsageNote, setAiUsageNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const candidateId = localStorage.getItem("candidate_id");
    const token = localStorage.getItem("candidate_token");
    if (!candidateId || !token) {
      router.push("/candidate/login");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch(`/api/candidates/${candidateId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-candidate-token": token },
      body: JSON.stringify({ final_solution: finalSolution, ai_usage_note: aiUsageNote, candidate_token: token })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.message ?? data.error);
      return;
    }
    router.push("/candidate/done");
  }

  return (
    <div className="container narrow">
      <FlowGuide active={5} />
      <section className="panel">
        <h1 className="title">提交最终方案</h1>
        <p className="subtitle">最终提交后系统会调用候选人当前选择的大模型生成最终评分报告。</p>
        <div className="field">
          <label>最终方案</label>
          <textarea className="textarea" value={finalSolution} onChange={(event) => setFinalSolution(event.target.value)} />
        </div>
        <div className="field">
          <label>AI 使用说明</label>
          <textarea className="textarea" value={aiUsageNote} onChange={(event) => setAiUsageNote(event.target.value)} />
        </div>
        <button className="btn" onClick={submit} disabled={loading || !finalSolution.trim()}>
          {loading ? "正在调用模型生成最终评估..." : "提交并生成 AI 评估"}
        </button>
        {error ? <p className="badge cut">{error}</p> : null}
      </section>
    </div>
  );
}
