请生成“基础关卡”的开场题。

要求：
- 只输出合法 JSON。
- 题目必须结合候选人的人物画像、目标难度、能力维度和 Agent 参与策略。
- 题目不能是固定模板，要基于候选人画像动态调整追问重点。
- L2 难度重点考察“能执行”：候选人能否在明确约束下按产品经理方法完成一个可演示 MVP 方案。
- 题目必须让候选人暴露取舍、边界、落地路径和判断依据。
- 题目必须是候选人可以直接作答的一段完整中文任务。

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
  "question": "给候选人的完整题目，包含背景、任务、时间/资源约束和必须回答的要点",
  "stage_goal": "本关考察目标",
  "must_cover_dimensions": ["需要覆盖的能力维度 key 或名称"],
  "expected_evidence": ["期望候选人在回答中留下的证据点"]
}
