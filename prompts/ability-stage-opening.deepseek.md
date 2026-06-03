请生成“能力关卡”的开场题。

要求：
- 只输出合法 JSON。
- 题目必须加入时间、人力、技术、误判、证据留痕等压力约束。
- 必须结合候选人画像、目标难度、能力维度和 Agent 参与策略。
- 题目需要验证候选人在资源受限下的取舍、流程设计、指标设计、风险控制和 AI 使用边界。
- 题目不能和基础关卡重复，必须更偏实战和约束。

候选人画像：
{{personaProfile}}

目标岗位：{{targetRole}}

目标难度：{{targetDifficulty}}

能力维度：
{{abilityDimensions}}

Agent 参与策略：
{{agentParticipation}}

出题策略：
{{questionStrategy}}

可用 Agent：
{{agents}}

输出 JSON 格式：
{
  "question": "给候选人的完整能力关卡题目，包含背景、约束、必须取舍的问题和交付物要求",
  "stage_goal": "本关考察目标",
  "must_cover_dimensions": ["需要覆盖的能力维度 key 或名称"],
  "expected_evidence": ["期望候选人在回答中留下的证据点"]
}
