请基于候选人上一轮回答、本轮评分、对话历史和基础关卡目标，生成下一道追问题。

要求：
- 只输出合法 JSON，不要输出 Markdown。
- 只问一个核心问题。
- 问题要短、尖锐、可作答，能暴露任务理解、结构化、AI 使用透明度、变化响应或最终交付能力。
- 必须结合本轮评分中的薄弱维度和 next_question_standard。
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
