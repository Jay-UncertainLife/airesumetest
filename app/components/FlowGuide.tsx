const steps = ["上传简历", "目标岗位", "面试准备", "基础关卡", "能力关卡", "最终提交", "审核复核"];

export default function FlowGuide({ active = 0 }: { active?: number }) {
  return (
    <div className="flow-guide">
      {steps.map((step, index) => (
        <div className={`flow-step ${index <= active ? "active" : ""}`} key={step}>
          <span>{index + 1}</span>
          {step}
        </div>
      ))}
    </div>
  );
}
