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
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/agents/${params.id}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("agent not found");
        return res.json();
      })
      .then((data) => setForm(data.agent))
      .catch(() => setError("Agent 加载失败，可能已被删除或本地数据未刷新。"));
  }, [params.id]);

  function update(key: string, value: string) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  async function save() {
    if (!form) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/agents/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    setLoading(false);
    if (!res.ok) {
      setError("保存失败，请稍后重试。");
      return;
    }
    router.push("/admin/agents");
    router.refresh();
  }

  async function remove() {
    if (!confirm("确认删除这个 Agent？")) return;
    setLoading(true);
    const res = await fetch(`/api/agents/${params.id}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      setError("删除失败，请稍后重试。");
      return;
    }
    router.push("/admin/agents");
    router.refresh();
  }

  if (error && !form) return <div className="container"><BackLink /><p className="badge cut">{error}</p></div>;
  if (!form) return <div className="container">加载 Agent...</div>;

  return (
    <div className="container narrow">
      <BackLink />
      <section className="panel">
        <h1 className="title">编辑 AI Agent</h1>
        {fields.map((key) => (
          <div className="field" key={key}>
            <label>{fieldLabel(key)}</label>
            <Field keyName={key} value={form[key] ?? ""} onChange={(next) => update(key, next)} />
          </div>
        ))}
        {error ? <p className="badge cut">{error}</p> : null}
        <div className="actions">
          <button className="btn" onClick={save} disabled={loading}>{loading ? "保存中..." : "保存修改"}</button>
          <button className="btn danger" onClick={remove} disabled={loading}>删除 Agent</button>
        </div>
      </section>
    </div>
  );
}

function Field({ keyName, value, onChange }: { keyName: string; value: string; onChange: (value: string) => void }) {
  if (keyName === "status") {
    return <select className="select" value={value} onChange={(event) => onChange(event.target.value)}><option value="enabled">enabled</option><option value="disabled">disabled</option></select>;
  }
  if (keyName === "agent_role") {
    return <select className="select" value={value} onChange={(event) => onChange(event.target.value)}><option value="lead_examiner">lead_examiner</option><option value="product_judge">product_judge</option><option value="pressure_judge">pressure_judge</option><option value="evidence_judge">evidence_judge</option><option value="custom">custom</option></select>;
  }
  if (keyName === "model_provider") {
    return <select className="select" value={value} onChange={(event) => onChange(event.target.value)}><option value="deepseek">deepseek</option><option value="openai">openai</option></select>;
  }
  if (keyName.includes("rules") || keyName.includes("prompt") || keyName === "exam_goal" || keyName === "responsibility" || keyName === "cut_rules") {
    return <textarea className="textarea" value={value} onChange={(event) => onChange(event.target.value)} />;
  }
  return <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />;
}

function fieldLabel(key: string) {
  const labels: Record<string, string> = {
    name: "Agent 名称",
    target_role: "目标岗位",
    agent_role: "Agent 分工",
    model_provider: "模型供应商",
    model_name: "具体模型",
    persona: "角色风格",
    responsibility: "职责",
    exam_goal: "考核目标",
    opening_prompt: "开场提示词",
    follow_up_rules: "追问规则",
    pressure_rules: "加压规则",
    scoring_rubric: "评分规则",
    cut_rules: "Cut 规则",
    status: "状态"
  };
  return labels[key] ?? key;
}
