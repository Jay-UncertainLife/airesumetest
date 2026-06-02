import Link from "next/link";
import BackLink from "@/app/components/BackLink";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AdminCandidatesPage() {
  const store = await readStore();
  return (
    <div className="container">
      <BackLink />
      <h1 className="title">候选人列表</h1>
      <table className="table">
        <thead>
          <tr>
            <th>候选人姓名</th>
            <th>目标角色</th>
            <th>当前状态</th>
            <th>最终建议</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {store.candidates.map((candidate) => (
            <tr key={candidate.id}>
              <td>{candidate.name}</td>
              <td>{candidate.target_role ?? "-"}</td>
              <td>{candidate.status}</td>
              <td>
                {candidate.final_recommendation ?? "-"}
                {store.eventLogs.some((event) => event.candidate_id === candidate.id && event.event_type === "human_review_required") ? (
                  <span className="badge cut" style={{ marginLeft: 8 }}>需人工复核</span>
                ) : null}
              </td>
              <td>{new Date(candidate.created_at).toLocaleString()}</td>
              <td>
                <Link className="btn secondary" href={`/admin/candidates/${candidate.id}`}>
                  查看详情
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
