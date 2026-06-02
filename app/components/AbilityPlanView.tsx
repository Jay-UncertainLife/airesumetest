import { AbilityPlan } from "@/lib/types";

export default function AbilityPlanView({ plan }: { plan?: AbilityPlan }) {
  if (!plan) return <p className="muted">尚未生成动态能力组合。</p>;
  return (
    <div className="plan-view">
      <div>
        <h3>能力维度组合</h3>
        {plan.dimensions.map((dimension) => (
          <div className="bar-row" key={dimension.key}>
            <div className="bar-label">
              <span>{dimension.name}</span>
              <strong>{dimension.weight}%</strong>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${dimension.weight}%` }} />
            </div>
            <p className="muted">{dimension.description}</p>
          </div>
        ))}
      </div>
      <div>
        <h3>AI Agent 参与度</h3>
        {plan.agent_participation.map((agent) => (
          <div className="bar-row" key={agent.agent_role}>
            <div className="bar-label">
              <span>{agent.agent_name}</span>
              <strong>{agent.weight}%</strong>
            </div>
            <div className="bar-track">
              <div className="bar-fill agent" style={{ width: `${agent.weight}%` }} />
            </div>
            <p className="muted">{agent.responsibility}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
