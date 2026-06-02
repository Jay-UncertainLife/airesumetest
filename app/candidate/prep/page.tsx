"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FlowGuide from "@/app/components/FlowGuide";
import { difficultyDefinitions, participationDefinitions } from "@/lib/stages";
import { Candidate, JobRole } from "@/lib/types";

export default function CandidatePrepPage() {
  const router = useRouter();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [jobRole, setJobRole] = useState<JobRole | null>(null);

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

  async function enterBasicStage() {
    if (!candidate) return;
    await fetch(`/api/candidates/${candidate.id}/stage/advance`, { method: "POST" });
    router.push("/candidate/arena");
  }

  if (!candidate || !jobRole) return <div className="container">加载面试关卡准备...</div>;

  return (
    <div className="container">
      <FlowGuide active={2} />
      <h1 className="title">面试关卡准备</h1>
      <p className="subtitle">目标岗位：{jobRole.name} · 难度 {jobRole.difficulty}。系统将在进入基础关卡前确认能力维度和 AI 考核官参与度。</p>

      <section className="panel">
        <h2>难度评级</h2>
        <table className="table">
          <thead><tr><th>难度</th><th>定义</th><th>适合候选人</th><th>关卡表现</th></tr></thead>
          <tbody>
            {difficultyDefinitions.map((item) => (
              <tr key={item.level} className={item.level === jobRole.difficulty ? "highlight-row" : ""}>
                <td>{item.level}</td><td>{item.definition}</td><td>{item.fit}</td><td>{item.behavior}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>AI 考核官参与程度定义</h2>
        <table className="table">
          <thead><tr><th>参与度</th><th>定义</th><th>作用</th></tr></thead>
          <tbody>
            {Object.entries(participationDefinitions).map(([level, item]) => (
              <tr key={level}><td>{level}</td><td>{item.definition}</td><td>{item.effect}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>目标岗位能力维度</h2>
        <table className="table">
          <thead><tr><th>编号</th><th>能力维度</th><th>目标等级</th><th>定义</th><th>主要观察点</th></tr></thead>
          <tbody>
            {jobRole.ability_dimensions.map((item) => (
              <tr key={item.key}>
                <td>{item.code}</td><td>{item.name}</td><td>{item.target_level}</td><td>{item.description}</td><td>{item.observation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        <ParticipationTable title="基础关卡 AI 角色参与度" rows={jobRole.basic_participation} />
        <ParticipationTable title="能力关卡 AI 角色参与度" rows={jobRole.ability_participation} />
      </div>

      <div className="actions">
        <button className="btn" onClick={enterBasicStage}>确认准备完成，进入基础关卡</button>
      </div>
    </div>
  );
}

function ParticipationTable({ title, rows }: { title: string; rows: JobRole["basic_participation"] }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <table className="table">
        <thead><tr><th>AI 角色</th><th>参与度</th><th>原因</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.ai_role}-${row.level}`}><td>{row.ai_role}</td><td>{row.level}</td><td>{row.reason}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
