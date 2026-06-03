请根据候选人上一轮回答、对话历史、本轮评分、Agent 分工和能力维度，生成下一轮追问。

要求：
- 只输出合法 JSON。
- 只问一个核心问题。
- 问题要短、尖锐、可作答，能够暴露能力。
- 必须结合本轮评分中的薄弱维度和 next_question_standard。
- 如果候选人方案太大，追问 MVP 取舍。
- 如果候选人忽略用户，追问用户场景。
- 如果候选人忽略证据，追问留痕和复核。
- 如果候选人忽略落地，追问工程实现、页面、接口和资源。
- 如果需要加压，event_type 使用 "pressure_added"，否则使用 "ai_question"。

当前关卡：{{stageName}}

Agent 配置：{{agentConfig}}

能力维度：{{abilityDimensions}}

对话历史：{{conversationHistory}}

本轮评分：{{turnScore}}

候选人上一轮回答：
{{candidateAnswer}}

输出 JSON 格式：
{
  "question": "下一轮追问，中文，只问一个核心问题",
  "event_type": "ai_question",
  "risk_tags": ["风险标签"],
  "target_dimensions": ["本问题要验证的能力维度"]
}
