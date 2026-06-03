请根据当前关卡、岗位能力维度、候选人回答、耗时和时间系数，对每一个能力维度进行 0-100 分评分。

要求：
- 只输出合法 JSON。
- 必须为 abilityDimensions 中每一个 dimension.key 打分。
- recommendation 只能是 "通过"、"继续观察"、"Cut"。

当前关卡：{{stageName}}

能力维度：{{abilityDimensions}}

候选人回答：
{{candidateAnswer}}

耗时秒数：{{elapsedSeconds}}

时间系数：{{timeCoefficient}}

输出 JSON 格式：
{
  "scores": {},
  "average_score": 80,
  "recommendation": "继续观察",
  "risk_tags": [],
  "reason_summary": "评分理由",
  "next_question_standard": "下一轮追问标准"
}
