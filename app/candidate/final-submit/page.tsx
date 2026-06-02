"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FlowGuide from "@/app/components/FlowGuide";

export default function FinalSubmitPage() {
  const router = useRouter();
  const [finalSolution, setFinalSolution] = useState("");
  const [aiUsageNote, setAiUsageNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    const candidateId = localStorage.getItem("candidate_id");
    if (!candidateId) {
      router.push("/candidate/login");
      return;
    }
    setLoading(true);
    await fetch(`/api/candidates/${candidateId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ final_solution: finalSolution, ai_usage_note: aiUsageNote })
    });
    router.push("/candidate/done");
  }

  return (
    <div className="container narrow">
      <FlowGuide active={5} />
      <section className="panel">
        <h1 className="title">提交最终方案</h1>
        <p className="subtitle">最终提交后不可修改。请写清楚方案和 AI 使用边界，审核人员会结合过程证据查看。</p>
        <div className="field">
          <label>final_solution</label>
          <textarea className="textarea" value={finalSolution} onChange={(event) => setFinalSolution(event.target.value)} />
        </div>
        <div className="field">
          <label>ai_usage_note</label>
          <textarea
            className="textarea"
            value={aiUsageNote}
            onChange={(event) => setAiUsageNote(event.target.value)}
            placeholder="我使用了哪些 AI 工具？采纳、否定和修改了哪些建议？哪些判断是我自己的？"
          />
        </div>
        <button className="btn" onClick={submit} disabled={loading || !finalSolution.trim()}>
          {loading ? "生成评估中..." : "提交并生成 AI 评估"}
        </button>
      </section>
    </div>
  );
}
