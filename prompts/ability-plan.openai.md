请为 AI 产品经理岗位生成本次候选人的动态能力考核计划。

要求：
- 只输出合法 JSON。
- 必须结合目标岗位、难度、候选人画像和当前 Agent 配置。
- 能力维度应覆盖 P01-P08，但可以根据候选人画像调整权重。
- Agent 参与度必须只使用 P0、P1、P2、P3。

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
  "dimensions": [],
  "agent_participation": [],
  "question_strategy": []
}
