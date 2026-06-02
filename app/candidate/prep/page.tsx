"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FlowGuide from "@/app/components/FlowGuide";
import { Agent, Candidate, JobRole } from "@/lib/types";

export default function CandidatePrepPage() {
  const router = useRouter();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [jobRole, setJobRole] = useState<JobRole | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const dimensions = useMemo(() => jobRole?.ability_dimensions ?? [], [jobRole]);

  useEffect(() => {
    const candidateId = localStorage.getItem("candidate_id");
    const token = localStorage.getItem("candidate_token");
    if (!candidateId || !token) {
      router.push("/candidate/login");
      return;
    }
    fetch(`/api/candidates/${candidateId}`, { cache: "no-store", headers: { "x-candidate-token": token } })
      .then((res) => res.json())
      .then((data) => {
        setCandidate(data.candidate);
        setAgents((data.agents ?? []).slice(0, 4));
      });
    fetch("/api/job-roles", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setJobRole(data.jobRoles?.[0] ?? null));
  }, [router]);

  async function enterBasicStage() {
    if (!candidate) return;
    const token = localStorage.getItem("candidate_token");
    setLoading(true);
    await fetch(`/api/candidates/${candidate.id}/stage/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-candidate-token": token ?? "" },
      body: JSON.stringify({ candidate_token: token })
    });
    router.push("/candidate/arena");
  }

  if (!candidate || !jobRole) return <div className="container">加载面试关卡准备...</div>;

  return (
    <div className="container">
      <FlowGuide active={2} />
      <h1 className="title">面试关卡准备</h1>
      <p className="subtitle">目标岗位：{candidate.target_role ?? jobRole.name} · 难度 {candidate.target_difficulty ?? jobRole.difficulty}。系统已基于审核员上传的简历、面试评价和 DeepSeek 画像完成准备。</p>

      <section className="panel">
        <h2>本次启用的 AI 考核官</h2>
        <div className="grid grid-4">
          {agents.map((agent) => (
            <div className="card compact-card" key={agent.id}>
              <strong>{agent.name}</strong>
              <p className="muted">{agent.agent_role}</p>
              <p>{agent.responsibility}</p>
              <span className="badge">{agent.model_provider} / {agent.model_name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>AI 产品经理能力维度</h2>
        <div className="dimension-grid">
          {dimensions.map((item) => (
            <div className="dimension-chip" key={item.key}>
              <span>{item.code}</span>
              <strong>{item.name}</strong>
              <small>{item.target_level} · 权重 {item.weight}%</small>
            </div>
          ))}
        </div>
      </section>

      <div className="actions">
        <button className="btn" onClick={enterBasicStage} disabled={loading}>
          {loading ? "正在调用模型生成基础关卡..." : "确认准备完成，进入基础关卡"}
        </button>
      </div>
    </div>
  );
}
