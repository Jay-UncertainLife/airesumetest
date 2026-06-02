"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const isCandidate = pathname.startsWith("/candidate");
  const isAdmin = pathname.startsWith("/admin");

  function logout() {
    if (isCandidate) localStorage.removeItem("candidate_id");
    if (isAdmin) localStorage.removeItem("admin_auth");
    window.location.assign("/");
  }

  return (
    <div className="topbar">
      <Link className="brand" href="/">
        AI Cut Arena
      </Link>
      <nav className="nav">
        {!isCandidate && !isAdmin ? (
          <>
            <Link href="/candidate/login">候选人入口</Link>
            <Link href="/admin/login">审核入口</Link>
          </>
        ) : null}
        {isCandidate ? (
          <button className="btn secondary" onClick={logout}>Logout</button>
        ) : null}
        {isAdmin ? (
          <button className="btn secondary" onClick={logout}>Logout</button>
        ) : null}
      </nav>
    </div>
  );
}
