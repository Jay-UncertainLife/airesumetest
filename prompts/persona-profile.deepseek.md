请基于审核官上传的简历文本和多轮面试评价，生成候选人的 AI 产品经理岗位画像。

要求：
- 只输出合法 JSON。
- 不要输出 Markdown。
- 不要虚构简历和面试评价之外的信息。
- 如果信息不足，请在 risks 和 interview_focus 中明确指出。
- 画像必须服务于后续基础关卡、能力关卡和追问策略。

候选人姓名：{{candidateName}}

目标岗位：{{targetRole}}

目标难度：{{targetDifficulty}}

简历文本：
{{resumeText}}

审核官多轮面试评价：
{{interviewerEvaluations}}

输出 JSON 格式：
{
  "summary": "候选人画像摘要",
  "strengths": ["优势信号"],
  "risks": ["风险或不确定信号"],
  "interview_focus": ["后续关卡需要重点验证的问题"],
  "resume_signals": ["来自简历的证据"],
  "interviewer_signals": ["来自审核官评价的证据"],
  "role_fit": "与目标岗位和难度的匹配判断",
  "source_model": "deepseek"
}
