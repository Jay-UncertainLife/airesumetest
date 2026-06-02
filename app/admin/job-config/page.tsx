"use client";

import { useEffect, useState } from "react";
import BackLink from "@/app/components/BackLink";
import { DifficultyLevel, JobRole, ParticipationLevel } from "@/lib/types";

export default function AdminJobConfigPage() {
  const [job, setJob] = useState<JobRole | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/job-roles")
      .then((res) => res.json())
      .then((data) => setJob(data.jobRoles?.[0] ?? null));
  }, []);

  async function save() {
    if (!job) return;
    setSaving(true);
    const res = await fetch("/api/job-roles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job)
    });
    const data = await res.json();
    setJob(data.jobRole);
    setSaving(false);
  }

  if (!job) return <div className="container">加载岗位配置...</div>;

  return (
    <div className="container">
      <BackLink />
      <h1 className="title">目标岗位配置</h1>
      <section className="panel">
        <div className="field">
          <label>岗位名称</label>
          <input className="input" value={job.name} onChange={(event) => setJob({ ...job, name: event.target.value })} />
        </div>
        <div className="field">
          <label>难度评级</label>
          <select className="select" value={job.difficulty} onChange={(event) => setJob({ ...job, difficulty: event.target.value as DifficultyLevel })}>
            {["L1", "L2", "L3", "L4", "L5"].map((level) => <option key={level}>{level}</option>)}
          </select>
        </div>
        <div className="field">
          <label>岗位说明</label>
          <textarea className="textarea" value={job.description} onChange={(event) => setJob({ ...job, description: event.target.value })} />
        </div>
      </section>

      <section className="panel">
        <h2>能力维度</h2>
        <table className="table">
          <thead><tr><th>编号</th><th>能力维度</th><th>权重</th><th>目标等级</th><th>观察点</th></tr></thead>
          <tbody>
            {job.ability_dimensions.map((dimension, index) => (
              <tr key={dimension.key}>
                <td>{dimension.code}</td>
                <td>{dimension.name}</td>
                <td><input className="input" value={dimension.weight} onChange={(event) => updateDimension(index, "weight", Number(event.target.value))} /></td>
                <td>
                  <select className="select" value={dimension.target_level} onChange={(event) => updateDimension(index, "target_level", event.target.value as DifficultyLevel)}>
                    {["L1", "L2", "L3", "L4", "L5"].map((level) => <option key={level}>{level}</option>)}
                  </select>
                </td>
                <td><input className="input" value={dimension.observation ?? ""} onChange={(event) => updateDimension(index, "observation", event.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        <ParticipationEditor title="基础关卡参与度" rows={job.basic_participation} onChange={(rows) => setJob({ ...job, basic_participation: rows })} />
        <ParticipationEditor title="能力关卡参与度" rows={job.ability_participation} onChange={(rows) => setJob({ ...job, ability_participation: rows })} />
      </div>

      <button className="btn" onClick={save} disabled={saving}>{saving ? "保存中..." : "保存岗位配置"}</button>
    </div>
  );

  function updateDimension(index: number, key: string, value: string | number) {
    const ability_dimensions = [...job!.ability_dimensions];
    ability_dimensions[index] = { ...ability_dimensions[index], [key]: value };
    setJob({ ...job!, ability_dimensions });
  }
}

function ParticipationEditor({
  title,
  rows,
  onChange
}: {
  title: string;
  rows: JobRole["basic_participation"];
  onChange: (rows: JobRole["basic_participation"]) => void;
}) {
  function update(index: number, key: string, value: string) {
    const next = [...rows];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  }

  return (
    <section className="panel">
      <h2>{title}</h2>
      <table className="table">
        <thead><tr><th>AI 角色</th><th>参与度</th><th>原因</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.ai_role}>
              <td>{row.ai_role}</td>
              <td>
                <select className="select" value={row.level} onChange={(event) => update(index, "level", event.target.value as ParticipationLevel)}>
                  {["P0", "P1", "P2", "P3"].map((level) => <option key={level}>{level}</option>)}
                </select>
              </td>
              <td><input className="input" value={row.reason} onChange={(event) => update(index, "reason", event.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
