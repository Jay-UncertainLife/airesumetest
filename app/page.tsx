import Link from "next/link";

export default function HomePage() {
  return (
    <div className="container">
      <section className="panel">
        <p className="badge">小闭环产品版</p>
        <h1 className="title">AI Cut Arena</h1>
        <p className="subtitle">
          一个由 AI 考核官主动追问、施加约束、记录过程证据，并生成通过 / 继续观察 / Cut 建议的闯关考核 MVP。
        </p>
        <div className="actions">
          <Link className="btn" href="/candidate/login">
            候选人登录
          </Link>
          <Link className="btn secondary" href="/admin/login">
            审核人员登录
          </Link>
        </div>
      </section>
    </div>
  );
}
