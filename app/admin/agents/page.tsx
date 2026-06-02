"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackLink from "@/app/components/BackLink";
import { Agent } from "@/lib/types";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agents", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setAgents(data.agents ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <BackLink />
      <div className="actions" style={{ justifyContent: "space-between" }}>
        <h1 className="title">AI Agent 列表</h1>
        <Link className="btn" href="/admin/agents/new">创建 Agent</Link>
      </div>
      {loading ? <p className="muted">正在加载 Agent...</p> : null}
      <table className="table">
        <thead>
          <tr>
            <th>Agent 名称</th>
            <th>目标岗位</th>
            <th>分工</th>
            <th>职责</th>
            <th>模型</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent.id}>
              <td>{agent.name}</td>
              <td>{agent.target_role}</td>
              <td>{agent.agent_role}</td>
              <td>{agent.responsibility}</td>
              <td>{agent.model_provider} / {agent.model_name}</td>
              <td>{agent.status}</td>
              <td>{new Date(agent.created_at).toLocaleString()}</td>
              <td><Link className="btn secondary" href={`/admin/agents/${agent.id}/edit`}>编辑</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
