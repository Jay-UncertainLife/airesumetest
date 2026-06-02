import Link from "next/link";

export default function CandidateLoginPage() {
  return (
    <div className="container narrow">
      <section className="panel">
        <h1 className="title">候选人入口</h1>
        <p className="subtitle">
          请使用审核人员生成的专属链接进入考核。本系统不允许候选人自行上传简历或创建考核档案。
        </p>
        <Link className="btn secondary" href="/">返回首页</Link>
      </section>
    </div>
  );
}
