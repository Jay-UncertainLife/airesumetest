请根据当前关卡、能力维度、候选人正式回答、AI 使用说明、耗时和时间系数进行逐题评分。

要求：
- 只输出合法 JSON，不要输出 Markdown。
- 必须为 abilityDimensions 中每一个 dimension.key 打 0-100 分。
- 评分重点：任务接收、信息整理、AI 使用留痕、变化响应、最终交付。
- 内容分由你判断；时间系数已由后端计算，请在 average_score 中综合考虑。
- recommendation 只能是 "通过"、"继续观察"、"Cut"。
- reason_summary 必须引用候选人回答中的具体证据。
- next_question_standard 说明下一题应验证什么。

当前关卡：
{{stageName}}

能力维度：
{{abilityDimensions}}

候选人正式回答：
{{candidateAnswer}}

AI 使用说明：
{{aiUsageNote}}

耗时秒数：
{{elapsedSeconds}}

时间系数：
{{timeCoefficient}}

输出 JSON 格式：
{
  "scores": {
    "dimension_key": 80
  },
  "average_score": 80,
  "recommendation": "继续观察",
  "risk_tags": ["风险标签"],
  "reason_summary": "评分理由，必须包含证据",
  "next_question_standard": "下一轮追问标准"
}
