import Link from "next/link";
import BackLink from "@/app/components/BackLink";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const store = await readStore();
  return (
    <div className="container">
      <BackLink />
      <div className="actions" style={{ justifyContent: "space-between" }}>
        <h1 className="title">AI Agent 列表</h1>
        <Link className="btn" href="/admin/agents/new">
          创建 Agent
        </Link>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Agent 名称</th>
            <th>目标角色</th>
            <th>分工</th>
            <th>性格</th>
            <th>职责</th>
            <th>模型</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {store.agents.map((agent) => (
            <tr key={agent.id}>
              <td>{agent.name}</td>
              <td>{agent.target_role}</td>
              <td>{agent.agent_role}</td>
              <td>{agent.persona}</td>
              <td>{agent.responsibility}</td>
              <td>{agent.model_provider} / {agent.model_name}</td>
              <td>{agent.status}</td>
              <td>{new Date(agent.created_at).toLocaleString()}</td>
              <td>
                <Link className="btn secondary" href={`/admin/agents/${agent.id}/edit`}>编辑</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
