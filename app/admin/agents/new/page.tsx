"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BackLink from "@/app/components/BackLink";

const defaults = {
  name: "AI 产品负责人考核官",
  target_role: "AI 产品负责人",
  agent_role: "custom",
  model_provider: "deepseek",
  model_name: "deepseek-chat",
  persona: "直接、追问型、偏业务结果导向",
  responsibility: "自定义考核分工",
  exam_goal: "评估候选人是否能设计可演示、可评分的 AI 产品 MVP。",
  opening_prompt: "请候选人在限定时间内设计一个 AI 考核产品 MVP。",
  follow_up_rules: "如果回答过泛，追问用户、场景、闭环、取舍、落地方式。",
  pressure_rules: "在第二关加入时间、人力、技术限制。",
  scoring_rubric: "按问题理解、产品闭环、优先级判断、约束下应变、表达与方案完整度评分。",
  cut_rules: "如果候选人无法说明核心闭环、持续范围失控、方案不可落地、完全复述概念，建议 Cut。",
  status: "enabled"
};

export default function NewAgentPage() {
  const router = useRouter();
  const [form, setForm] = useState(defaults);
  const [loading, setLoading] = useState(false);

  function update(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setLoading(true);
    await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    router.push("/admin/agents");
  }

  return (
    <div className="container narrow">
      <BackLink />
      <section className="panel">
        <h1 className="title">创建 AI Agent</h1>
        {Object.entries(form).map(([key, value]) => (
          <div className="field" key={key}>
            <label>{key}</label>
            {key === "status" ? (
              <select className="select" value={value} onChange={(event) => update(key, event.target.value)}>
                <option value="enabled">enabled</option>
                <option value="disabled">disabled</option>
              </select>
            ) : key === "agent_role" ? (
              <select className="select" value={value} onChange={(event) => update(key, event.target.value)}>
                <option value="lead_examiner">lead_examiner</option>
                <option value="product_judge">product_judge</option>
                <option value="pressure_judge">pressure_judge</option>
                <option value="evidence_judge">evidence_judge</option>
                <option value="custom">custom</option>
              </select>
            ) : key === "model_provider" ? (
              <select className="select" value={value} onChange={(event) => update(key, event.target.value)}>
                <option value="deepseek">deepseek</option>
                <option value="openai">openai</option>
              </select>
            ) : key.includes("rules") || key.includes("prompt") || key === "cut_rules" || key === "exam_goal" ? (
              <textarea className="textarea" value={value} onChange={(event) => update(key, event.target.value)} />
            ) : (
              <input className="input" value={value} onChange={(event) => update(key, event.target.value)} />
            )}
          </div>
        ))}
        <button className="btn" onClick={submit} disabled={loading}>
          {loading ? "创建中..." : "创建 Agent"}
        </button>
      </section>
    </div>
  );
}
