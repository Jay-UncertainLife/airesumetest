"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CandidatePrepPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/candidate/arena");
  }, [router]);

  return <div className="container">正在进入基础关卡...</div>;
}
