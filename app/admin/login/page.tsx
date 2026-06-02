"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  function login() {
    if (username === "admin" && password === "admin123") {
      localStorage.setItem("admin_auth", "true");
      router.push("/admin/dashboard");
    } else {
      setError("账号或密码错误");
    }
  }

  return (
    <div className="container narrow">
      <section className="panel">
        <h1 className="title">审核人员登录</h1>
        <p className="subtitle">演示账号：admin / admin123</p>
        <div className="field">
          <label>账号</label>
          <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} />
        </div>
        <div className="field">
          <label>密码</label>
          <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {error ? <p className="badge cut">{error}</p> : null}
        <button className="btn" onClick={login}>
          登录审核端
        </button>
      </section>
    </div>
  );
}
