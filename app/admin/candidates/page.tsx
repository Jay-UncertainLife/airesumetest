"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackLink from "@/app/components/BackLink";
import { Candidate } from "@/lib/types";

type CandidateRow = Candidate & {
  match_status_label?: string;
  pass_status_label?: string;
};

export default function AdminCandidatesPage() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/candidates", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setCandidates(data.candidates ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <BackLink />
      <div className="actions" style={{ justifyContent: "space-between" }}>
        <h1 className="title">候选人列表</h1>
        <Link className="btn" href="/admin/candidates/new">创建候选人</Link>
      </div>
      {loading ? <p className="muted">正在同步 Supabase 候选人数据...</p> : null}
      <table className="table">
        <thead>
          <tr>
            <th>姓名</th>
            <th>目标岗位</th>
            <th>难度</th>
            <th>简历</th>
            <th>画像</th>
            <th>专属链接</th>
            <th>磨合状态</th>
            <th>创建时间</th>
            <th>操作</th>
            <th>通过状态</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => (
            <tr key={candidate.id}>
              <td>{candidate.name}</td>
              <td>{candidate.target_role ?? "-"}</td>
              <td>{candidate.target_difficulty ?? "-"}</td>
              <td>{candidate.resume_file_name ? "已上传" : "未上传"}</td>
              <td>{candidate.persona_profile ? "已生成" : "未生成"}</td>
              <td>
                {candidate.invite_url ? (
                  <button className="btn secondary" onClick={() => navigator.clipboard.writeText(candidate.invite_url ?? "")}>复制</button>
                ) : "-"}
              </td>
              <td>{candidate.match_status_label ?? candidate.status}</td>
              <td>{new Date(candidate.created_at).toLocaleString()}</td>
              <td><Link className="btn secondary" href={`/admin/candidates/${candidate.id}`}>查看详情</Link></td>
              <td><span className={`badge ${passStatusClass(candidate.pass_status_label)}`}>{candidate.pass_status_label ?? "-"}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function passStatusClass(status?: string) {
  if (status === "通过") return "";
  if (status === "继续观察" || status === "待人工复核") return "watch";
  if (status === "Cut") return "cut";
  return "secondary";
}
