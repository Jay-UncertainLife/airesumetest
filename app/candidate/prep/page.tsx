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
  const [error, setError] = useState("");
  const dimensions = useMemo(() => candidate?.ability_plan?.dimensions ?? jobRole?.ability_dimensions ?? [], [candidate, jobRole]);
  const participation = useMemo(() => candidate?.ability_plan?.agent_participation ?? [], [candidate]);

  useEffect(() => {
    const candidateId = localStorage.getItem("candidate_id");
    const token = localStorage.getItem("candidate_token");
    if (!candidateId || !token) {
      router.push("/candidate/login");
      return;
    }

    fetch(`/api/candidates/${candidateId}`, { cache: "no-store", headers: { "x-candidate-token": token } })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message ?? data.error ?? "读取候选人数据失败");
        setCandidate(data.candidate);
        setAgents((data.agents ?? []).slice(0, 4));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "读取候选人数据失败"));

    fetch("/api/job-roles", { cache: "no-store" })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message ?? data.error ?? "读取岗位配置失败");
        setJobRole(data.jobRoles?.[0] ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "读取岗位配置失败"));
  }, [router]);

  async function enterBasicStage() {
    if (!candidate) return;
    const token = localStorage.getItem("candidate_token");
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/stage/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-candidate-token": token ?? "" },
        body: JSON.stringify({ candidate_token: token })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "AI 考核官出题失败");
      }
      router.push("/candidate/arena");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 考核官出题失败");
    } finally {
      setLoading(false);
    }
  }

  if (!candidate || !jobRole) return <div className="container">加载面试关卡准备...</div>;

  return (
    <div className="container">
      <FlowGuide active={2} />
      <h1 className="title">面试关卡准备</h1>
      <p className="subtitle">
        目标岗位：{candidate.target_role ?? jobRole.name} / 难度 {candidate.target_difficulty ?? jobRole.difficulty}。
        系统将基于审核员上传的简历、面试评价和人物画像生成基础关卡首题。
      </p>
      {error ? <p className="badge cut">{error}</p> : null}

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

      {participation.length ? (
        <section className="panel">
          <h2>动态参与度</h2>
          <div className="grid grid-4">
            {participation.slice(0, 4).map((item) => (
              <div className="card compact-card" key={`${item.agent_role}-${item.agent_name}`}>
                <strong>{item.agent_name}</strong>
                <p className="badge">{item.participation_level ?? "P1"} / 权重 {item.weight}%</p>
                <p>{item.responsibility}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2>AI 产品经理能力维度</h2>
        <div className="dimension-grid">
          {dimensions.map((item) => (
            <div className="dimension-chip" key={item.key}>
              <span>{item.code}</span>
              <strong>{item.name}</strong>
              <small>{item.target_level} / 权重 {item.weight}%</small>
            </div>
          ))}
        </div>
      </section>

      <div className="actions">
        <button className="btn" onClick={enterBasicStage} disabled={loading}>
          {loading ? "正在调用模型生成基础关卡首题..." : "确认准备完成，进入基础关卡"}
        </button>
      </div>
    </div>
  );
}
