"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FlowGuide from "@/app/components/FlowGuide";
import { Candidate, JobRole } from "@/lib/types";

export default function CandidateRolesPage() {
  const router = useRouter();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [jobRole, setJobRole] = useState<JobRole | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const candidateId = localStorage.getItem("candidate_id");
    if (!candidateId) {
      router.push("/candidate/login");
      return;
    }
    fetch(`/api/candidates/${candidateId}`)
      .then((res) => res.json())
      .then((data) => setCandidate(data.candidate));
    fetch("/api/job-roles")
      .then((res) => res.json())
      .then((data) => setJobRole(data.jobRoles?.[0] ?? null));
  }, [router]);

  async function confirmApply() {
    const candidateId = localStorage.getItem("candidate_id");
    if (!candidateId) {
      router.push("/candidate/login");
      return;
    }
    setLoading(true);
    await fetch(`/api/candidates/${candidateId}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_role: jobRole?.name ?? "AI 产品经理" })
    });
    router.push("/candidate/prep");
  }

  return (
    <div className="container">
      <FlowGuide active={1} />
      <h1 className="title">选择目标岗位</h1>
      <p className="subtitle">当前仅开放一个测试岗位。管理员可在管理页面调整岗位难度、能力维度和 AI 考核官参与度。</p>
      {candidate?.persona_profile ? (
        <section className="panel" style={{ marginBottom: 18 }}>
          <h2>DS 人物画像</h2>
          <p>{candidate.persona_profile.summary}</p>
          <div className="actions">
            {candidate.persona_profile.interview_focus.map((item) => (
              <span className="badge" key={item}>{item}</span>
            ))}
          </div>
        </section>
      ) : null}

      <button className="card job-card" onClick={() => setConfirming(true)}>
        <div>
          <p className="badge">{jobRole?.difficulty ?? "L2"}</p>
          <h2>{jobRole?.name ?? "AI 产品经理"}</h2>
          <p className="muted">{jobRole?.description ?? "面向 AI 产品经理岗位的小闭环考核。"}</p>
        </div>
        <span className="btn secondary">投递</span>
      </button>

      {confirming ? (
        <div className="modal-backdrop">
          <section className="modal">
            <h2>确认投递目标岗位？</h2>
            <p>岗位：{jobRole?.name ?? "AI 产品经理"}</p>
            <p>难度：{jobRole?.difficulty ?? "L2"}</p>
            <p className="muted">确认后将进入“面试关卡准备”，系统会展示考核官参与度、能力维度和关卡策略。</p>
            <div className="actions">
              <button className="btn" onClick={confirmApply} disabled={loading}>
                {loading ? "生成准备信息..." : "确认投递"}
              </button>
              <button className="btn secondary" onClick={() => setConfirming(false)}>
                取消
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
