"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackLink from "@/app/components/BackLink";

const fields = [
  "name",
  "target_role",
  "agent_role",
  "model_provider",
  "model_name",
  "persona",
  "responsibility",
  "exam_goal",
  "opening_prompt",
  "follow_up_rules",
  "pressure_rules",
  "scoring_rubric",
  "cut_rules",
  "status"
];

export default function EditAgentPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/agents/${params.id}`)
      .then((res) => res.json())
      .then((data) => setForm(data.agent));
  }, [params.id]);

  function update(key: string, value: string) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  async function save() {
    if (!form) return;
    setLoading(true);
    await fetch(`/api/agents/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    router.push("/admin/agents");
  }

  async function remove() {
    if (!confirm("确认删除这个 Agent？")) return;
    setLoading(true);
    await fetch(`/api/agents/${params.id}`, { method: "DELETE" });
    router.push("/admin/agents");
  }

  if (!form) return <div className="container">加载 Agent...</div>;

  return (
    <div className="container narrow">
      <BackLink />
      <section className="panel">
        <h1 className="title">编辑 AI Agent</h1>
        {fields.map((key) => (
          <div className="field" key={key}>
            <label>{key}</label>
            {key === "status" ? (
              <select className="select" value={form[key]} onChange={(event) => update(key, event.target.value)}>
                <option value="enabled">enabled</option>
                <option value="disabled">disabled</option>
              </select>
            ) : key === "agent_role" ? (
              <select className="select" value={form[key]} onChange={(event) => update(key, event.target.value)}>
                <option value="lead_examiner">lead_examiner</option>
                <option value="product_judge">product_judge</option>
                <option value="pressure_judge">pressure_judge</option>
                <option value="evidence_judge">evidence_judge</option>
                <option value="custom">custom</option>
              </select>
            ) : key === "model_provider" ? (
              <select className="select" value={form[key]} onChange={(event) => update(key, event.target.value)}>
                <option value="deepseek">deepseek</option>
                <option value="openai">openai</option>
              </select>
            ) : key.includes("rules") || key.includes("prompt") || key === "exam_goal" || key === "responsibility" ? (
              <textarea className="textarea" value={form[key] ?? ""} onChange={(event) => update(key, event.target.value)} />
            ) : (
              <input className="input" value={form[key] ?? ""} onChange={(event) => update(key, event.target.value)} />
            )}
          </div>
        ))}
        <div className="actions">
          <button className="btn" onClick={save} disabled={loading}>{loading ? "保存中..." : "保存修改"}</button>
          <button className="btn danger" onClick={remove} disabled={loading}>删除 Agent</button>
        </div>
      </section>
    </div>
  );
}
