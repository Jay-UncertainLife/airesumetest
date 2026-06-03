请为 AI 产品经理岗位生成本次候选人的动态能力考核计划。

要求：
- 只输出合法 JSON。
- 必须结合目标岗位、难度、候选人画像和当前 Agent 配置。
- 能力维度应覆盖 P01-P08，但可以根据候选人画像调整权重。
- 权重总和不必手动等于 100，系统会归一化。
- Agent 参与度必须只使用 P0、P1、P2、P3。
- 不要生成固定题目，只生成能力维度、Agent 参与策略和出题策略。

目标岗位：{{targetRole}}

目标难度：{{targetDifficulty}}

候选人画像：
{{personaProfile}}

可用 Agent：
{{agents}}

兜底能力维度：
{{fallbackDimensions}}

输出 JSON 格式：
{
  "role": "AI 产品经理",
  "dimensions": [
    {
      "key": "ai_scene_identification",
      "code": "P01",
      "name": "AI 场景识别能力",
      "weight": 12,
      "target_level": "L2",
      "description": "考察定义",
      "observation": "主要观察点"
    }
  ],
  "agent_participation": [
    {
      "agent_role": "lead_examiner",
      "agent_name": "AI 产品负责人考核官",
      "weight": 35,
      "participation_level": "P3",
      "responsibility": "主导追问",
      "reason": "参与原因"
    }
  ],
  "question_strategy": ["基础关卡和能力关卡的出题策略"]
}
