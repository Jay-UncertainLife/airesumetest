"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Recommendation } from "@/lib/types";

export default function ReviewActions({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  async function review(result: Recommendation) {
    setLoading(true);
    await fetch(`/api/candidates/${candidateId}/evaluation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ human_review_result: result, human_review_comment: comment })
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="panel">
      <h2>人工复核</h2>
      <div className="field">
        <label>复核备注</label>
        <textarea className="textarea" value={comment} onChange={(event) => setComment(event.target.value)} />
      </div>
      <div className="actions">
        <button className="btn" onClick={() => review("通过")} disabled={loading}>
          确认通过
        </button>
        <button className="btn warn" onClick={() => review("继续观察")} disabled={loading}>
          继续观察
        </button>
        <button className="btn danger" onClick={() => review("Cut")} disabled={loading}>
          确认 Cut
        </button>
      </div>
    </div>
  );
}
