请生成“能力关卡”的第一道正式题目。

要求：
- 只输出合法 JSON，不要输出 Markdown。
- 题目必须结合候选人画像、简历、基础关卡表现、岗位职责、岗位能力维度和目标难度生成。
- 题目必须加入时间、人力、技术、证据留痕或业务误判等真实约束。
- 题目不能和基础关卡重复，必须更偏实战和约束下决策。
- 必须明确内部考察维度，但不要在 question 中向候选人暴露维度名称。

候选人画像：
{{personaProfile}}

候选人简历：
{{resumeText}}

目标岗位：
{{targetRole}}

目标难度：
{{targetDifficulty}}

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
  "dimension_key": "内部考察维度 key",
  "target_dimensions": ["内部考察维度 key"],
  "expected_evidence": ["期望候选人在回答中留下的证据点"]
}
