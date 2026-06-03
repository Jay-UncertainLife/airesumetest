"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CandidateInvite } from "@/lib/types";

export default function CandidateInvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [invite, setInvite] = useState<CandidateInvite | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/candidate/invite/${params.token}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message ?? data.error);
        setInvite(data.invite);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "链接无效"))
      .finally(() => setLoading(false));
  }, [params.token]);

  async function start() {
    const res = await fetch(`/api/candidate/invite/${params.token}/start`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? data.error);
      return;
    }
    localStorage.setItem("candidate_id", data.candidate_id);
    localStorage.setItem("candidate_token", params.token);
    router.push(data.next_url);
  }

  if (loading) return <div className="container">正在读取专属链接...</div>;
  if (error || !invite) return <div className="container"><p className="badge cut">{error || "链接不可用"}</p></div>;

  return (
    <div className="container narrow">
      <section className="panel">
        <h1 className="title">AI Cut Arena</h1>
        <p className="subtitle">候选人：{invite.name}</p>
        <p>目标岗位：{invite.target_role} / 难度 {invite.target_difficulty}</p>
        <p className="muted">本次考核会记录正式作答、AI 使用说明、关键事件、逐轮评分和最终报告。候选人端不会展示完整简历或面试官内部评价。</p>
        <button className="btn" onClick={start} disabled={!invite.whether_ready}>开始考核</button>
      </section>
    </div>
  );
}
