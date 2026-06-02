"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CandidateRolesPage() {
  const router = useRouter();

  useEffect(() => {
    const candidateId = localStorage.getItem("candidate_id");
    const token = localStorage.getItem("candidate_token");
    router.replace(candidateId && token ? "/candidate/prep" : "/candidate/login");
  }, [router]);

  return <div className="container">正在跳转...</div>;
}
