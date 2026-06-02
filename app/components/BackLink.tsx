"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function BackLink({ label = "返回" }: { label?: string }) {
  const router = useRouter();
  return (
    <button className="back-link" onClick={() => router.back()}>
      <ArrowLeft size={18} />
      {label}
    </button>
  );
}
