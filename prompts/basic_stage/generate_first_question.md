请生成“基础关卡”的第一道正式题目。

要求：
- 只输出合法 JSON，不要输出 Markdown。
- 题目必须结合候选人画像、简历、多轮面试评价、目标岗位、目标难度和基础能力维度生成。
- 基础关卡重点考察：任务接收、信息整理、AI 使用留痕、变化响应、最终交付。
- 题目必须是候选人可以直接作答的一段完整中文任务。
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
  "question": "给候选人的完整题目，包含背景、任务、时间/资源约束和必须回答的要点",
  "dimension_key": "内部考察维度 key",
  "target_dimensions": ["内部考察维度 key"],
  "expected_evidence": ["期望候选人在回答中留下的证据点"]
}
