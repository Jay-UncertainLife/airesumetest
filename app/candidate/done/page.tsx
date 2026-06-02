import Link from "next/link";
import FlowGuide from "@/app/components/FlowGuide";

export default function DonePage() {
  return (
    <div className="container narrow">
      <FlowGuide active={6} />
      <section className="panel">
        <h1 className="title">你的方案已提交</h1>
        <p className="subtitle">考核官将查看过程记录和最终报告。候选人端不展示完整评分。</p>
        <Link className="btn secondary" href="/">
          返回首页
        </Link>
      </section>
    </div>
  );
}
