"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FlowGuide from "@/app/components/FlowGuide";

export default function FinalSubmitPage() {
  const router = useRouter();
  const [finalSolution, setFinalSolution] = useState("");
  const [aiUsageNote, setAiUsageNote] = useState("");
  const [canSubmit, setCanSubmit] = useState(false);
  const [readiness, setReadiness] = useState("正在检查能力关卡完成状态...");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const candidateId = localStorage.getItem("candidate_id");
    const token = localStorage.getItem("candidate_token");
    if (!candidateId || !token) {
      router.push("/candidate/login");
      return;
    }
    fetch(`/api/candidates/${candidateId}`, { headers: { "x-candidate-token": token }, cache: "no-store" })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message ?? data.error ?? "读取候选人进度失败");
        const ready = Boolean(data.progress?.canSubmitFinal);
        setCanSubmit(ready);
        setReadiness(
          ready
            ? "能力关卡轮次已完成，可以提交最终方案。"
            : `能力关卡尚未完成，当前 ${data.progress?.answeredTurns ?? 0}/${data.progress?.requiredTurns ?? 2} 轮。`
        );
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
    if (!window.confirm("最终提交后不能返回修改，确认提交吗？")) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/candidates/${candidateId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-candidate-token": token },
      body: JSON.stringify({ final_solution: finalSolution, ai_usage_note: aiUsageNote, candidate_token: token, confirm: true })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.message ?? data.error ?? "最终提交失败");
      return;
    }
    router.replace("/candidate/done");
  }

  return (
    <div className="container narrow">
      <FlowGuide active={5} />
      <section className="panel final-submit-panel">
        <h1 className="title">提交最终方案</h1>
        <p className="subtitle">{readiness}</p>
        <div className="field">
          <label>最终方案</label>
          <textarea
            className="textarea answer-textarea"
            value={finalSolution}
            onChange={(event) => setFinalSolution(event.target.value)}
            disabled={!canSubmit || loading}
            placeholder="请提交你的最终方案、关键取舍、落地路径和可复盘交付物。"
          />
        </div>
        <div className="field">
          <label>AI 使用说明</label>
          <textarea
            className="textarea usage-textarea"
            value={aiUsageNote}
            onChange={(event) => setAiUsageNote(event.target.value)}
            disabled={!canSubmit || loading}
            placeholder="说明是否使用 AI、使用了什么、采纳/否定/修改了哪些内容。"
          />
        </div>
        <button className="btn" onClick={submit} disabled={loading || !canSubmit || !finalSolution.trim()}>
          {loading ? "正在调用模型生成最终评估..." : "二次确认并提交"}
        </button>
        {error ? <p className="badge cut">{error}</p> : null}
      </section>
    </div>
  );
}
