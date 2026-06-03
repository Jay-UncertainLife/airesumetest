请基于候选人的完整考核过程生成最终评审结果。

要求：
- 只输出合法 JSON，不要输出 Markdown。
- 不要复述原始画像，要基于基础关卡、能力关卡、最终方案、过程事件、评分和 AI 使用说明更新判断。
- 必须判断是否建议通过，并给出试用期验证重点或不通过依据。

原始候选人画像：
{{personaProfile}}

简历内容：
{{resumeText}}

多轮面试评价：
{{interviewerEvaluations}}

正式关卡对话：
{{conversationHistory}}

辅助 AI 对话留痕：
{{workspaceMessages}}

过程事件：
{{eventLogs}}

逐题评分：
{{turnScores}}

最终方案：
{{finalSolution}}

最终 AI 使用说明：
{{aiUsageNote}}

岗位能力维度：
{{abilityDimensions}}

输出 JSON 格式：
{
  "scores": {
    "overall": 80
  },
  "average_score": 80,
  "risk_tags": ["风险标签"],
  "recommendation": "通过",
  "reason_summary": "综合评价和通过/不通过依据",
  "evidence_summary": ["关键证据"],
  "reviewer_notes": "试用期考核建议、验证重点或主要风险点"
}
