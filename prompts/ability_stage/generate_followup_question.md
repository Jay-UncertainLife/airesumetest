请基于候选人上一轮回答、本轮评分、对话历史和能力关卡目标，生成下一道追问题。

要求：
- 只输出合法 JSON，不要输出 Markdown。
- 只问一个核心问题。
- 问题要结合岗位能力维度、上一轮薄弱点、风险标签和 next_question_standard。
- 如果候选人方案过大，追问 MVP 取舍；如果忽略证据，追问留痕和复核；如果忽略落地，追问工程实现、接口、资源和上线顺序。
- 如果需要加压，event_type 使用 "pressure_added"，否则使用 "ai_question"。

当前关卡：
{{stageName}}

Agent 配置：
{{agentConfig}}

能力维度：
{{abilityDimensions}}

对话历史：
{{conversationHistory}}

本轮评分：
{{turnScore}}

候选人上一轮回答：
{{candidateAnswer}}

输出 JSON 格式：
{
  "question": "下一轮追问，中文，只问一个核心问题",
  "event_type": "ai_question",
  "risk_tags": ["风险标签"],
  "target_dimensions": ["本问题要验证的能力维度"]
}
