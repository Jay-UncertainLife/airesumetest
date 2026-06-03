请根据候选人上一轮回答、对话历史、本轮评分、Agent 分工和能力维度，生成下一轮追问。

要求：
- 只输出合法 JSON。
- 只问一个核心问题。
- 必须结合本轮评分中的薄弱维度和 next_question_standard。

当前关卡：{{stageName}}

Agent 配置：{{agentConfig}}

能力维度：{{abilityDimensions}}

对话历史：{{conversationHistory}}

本轮评分：{{turnScore}}

候选人上一轮回答：
{{candidateAnswer}}

输出 JSON 格式：
{
  "question": "下一轮追问",
  "event_type": "ai_question",
  "risk_tags": [],
  "target_dimensions": []
}
