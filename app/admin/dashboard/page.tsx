import Link from "next/link";
import BackLink from "@/app/components/BackLink";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const store = await readStore();
  const completed = store.candidates.filter((item) => ["submitted", "evaluated", "reviewed"].includes(item.status)).length;
  const countByRecommendation = (value: string) =>
    store.candidates.filter((item) => item.final_recommendation === value).length;

  const metrics = [
    ["候选人总数", store.candidates.length],
    ["已完成考核", completed],
    ["通过", countByRecommendation("通过")],
    ["继续观察", countByRecommendation("继续观察")],
    ["Cut", countByRecommendation("Cut")],
    ["Agent 数量", store.agents.length]
  ];

  return (
    <div className="container">
      <BackLink />
      <h1 className="title">审核端概览</h1>
      <div className="grid grid-3">
        {metrics.map(([label, value]) => (
          <div className="card" key={label}>
            <div className="metric">{value}</div>
            <div className="muted">{label}</div>
          </div>
        ))}
      </div>
      <div className="actions" style={{ marginTop: 20 }}>
        <Link className="btn" href="/admin/candidates">
          查看候选人
        </Link>
        <Link className="btn secondary" href="/admin/agents">
          管理 Agent
        </Link>
        <Link className="btn secondary" href="/admin/job-config">
          岗位配置
        </Link>
      </div>
    </div>
  );
}
