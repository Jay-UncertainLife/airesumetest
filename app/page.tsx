import Link from "next/link";

export default function HomePage() {
  return (
    <div className="container">
      <section className="panel">
        <p className="badge">小闭环产品版</p>
        <h1 className="title">AI Cut Arena</h1>
        <p className="subtitle">
          由审核员建档、AI 考核官追问、模型评分、过程留痕和人工复核共同构成的 AI 产品经理考核 MVP。
        </p>
        <div className="actions">
          <Link className="btn secondary" href="/candidate/login">候选人入口说明</Link>
          <Link className="btn" href="/admin/login">审核人员登录</Link>
        </div>
      </section>
    </div>
  );
}
