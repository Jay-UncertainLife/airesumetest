import Link from "next/link";
import BackLink from "@/app/components/BackLink";
import { listAgents } from "@/lib/repositories/agents";
import { listCandidates } from "@/lib/repositories/candidates";
import { getSupabaseEnvStatus } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const envStatus = getSupabaseEnvStatus();

  if (!envStatus.hasSupabaseUrl || !envStatus.isSupabaseUrlValid || !envStatus.hasServiceRoleKey) {
    return (
      <div className="container">
        <BackLink />
        <section className="panel">
          <h1 className="title">审核端配置未完成</h1>
          <p className="subtitle">
            Vercel 当前部署没有读取到 Supabase 环境变量，请在 Project Settings 的 Environment Variables 中检查后重新部署。
          </p>
          <div className="grid grid-2">
            <div className="card">
              <strong>NEXT_PUBLIC_SUPABASE_URL</strong>
              <p className={envStatus.hasSupabaseUrl ? "badge pass" : "badge cut"}>
                {envStatus.hasSupabaseUrl ? "已读取" : "未读取"}
              </p>
              <p className={envStatus.isSupabaseUrlValid ? "badge pass" : "badge cut"}>
                {envStatus.isSupabaseUrlValid ? "URL 格式有效" : "URL 格式无效"}
              </p>
            </div>
            <div className="card">
              <strong>SUPABASE_SERVICE_ROLE_KEY</strong>
              <p className={envStatus.hasServiceRoleKey ? "badge pass" : "badge cut"}>
                {envStatus.hasServiceRoleKey ? "已读取" : "未读取"}
              </p>
            </div>
          </div>
          <p className="muted">诊断接口：/api/diagnostics/env。它只显示变量是否存在，不会返回密钥内容。</p>
        </section>
      </div>
    );
  }

  const [candidates, agents] = await Promise.all([listCandidates(), listAgents()]);
  const completed = candidates.filter((item) => ["submitted", "evaluated", "reviewed"].includes(item.status)).length;
  const countByRecommendation = (value: string) => candidates.filter((item) => item.final_recommendation === value).length;
  const metrics = [
    ["候选人总数", candidates.length],
    ["已完成考核", completed],
    ["通过", countByRecommendation("通过")],
    ["继续观察", countByRecommendation("继续观察")],
    ["Cut", countByRecommendation("Cut")],
    ["Agent 数量", agents.length]
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
        <Link className="btn" href="/admin/candidates/new">创建候选人</Link>
        <Link className="btn secondary" href="/admin/candidates">查看候选人</Link>
        <Link className="btn secondary" href="/admin/agents">管理 Agent</Link>
        <Link className="btn secondary" href="/admin/job-config">岗位配置</Link>
      </div>
    </div>
  );
}
