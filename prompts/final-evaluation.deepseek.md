请基于候选人的完整过程证据生成最终评估。

要求：
- 只输出合法 JSON。
- 必须综合画像、正式答题、事件日志、模型工作区使用记录、逐轮评分和最终方案。
- 结论只能是 "通过"、"继续观察"、"Cut"。
- evidence_summary 必须列出可以被审核官复核的证据。
- reviewer_notes 给审核官明确复核建议。

候选人画像：{{personaProfile}}

简历文本：{{resumeText}}

审核官面试评价：{{interviewerEvaluations}}

正式关卡对话：{{conversationHistory}}

关键事件：{{eventLogs}}

逐轮评分：{{turnScores}}

最终方案：{{finalSolution}}

AI 使用说明：{{aiUsageNote}}

能力维度：{{abilityDimensions}}

输出 JSON 格式：
{
  "scores": {},
  "average_score": 80,
  "risk_tags": [],
  "recommendation": "继续观察",
  "reason_summary": "最终判断理由",
  "evidence_summary": ["复核证据"],
  "reviewer_notes": "给审核官的复核建议"
}
