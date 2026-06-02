# AI Cut Arena

AI Cut Arena 是一个面向招聘场景的 AI 产品经理考核 MVP。当前版本采用“审核员建档 -> DeepSeek 画像 -> 生成候选人专属链接 -> 候选人闯关 -> DeepSeek/OpenAI 追问评分 -> 审核员复核”的闭环。

## 技术栈

- Next.js 14 App Router
- React 18 + TypeScript
- Supabase Postgres
- DeepSeek / OpenAI Chat Completions API
- `mammoth` 解析 DOCX，`pdfjs-dist` 解析 PDF

## 本地运行

```bash
npm install
npm run dev
```

本地访问：

```text
http://localhost:3000
```

本地构建：

```bash
npm run build
```

## 环境变量

复制 `.env.example` 到 `.env.local`：

```text
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
APP_BASE_URL=http://localhost:3000
```

说明：

- `SUPABASE_SERVICE_ROLE_KEY` 只能用于服务端，不能暴露给客户端。
- 不要提交真实 API Key。
- 不要使用 `DS-key.txt` 或 `chat_key.txt`。
- 生产环境不使用本地 JSON 文件，Vercel 上所有数据写入 Supabase。

## Supabase 初始化

1. 创建 Supabase Project。
2. 打开 SQL Editor。
3. 执行 `supabase/schema.sql`。
4. 复制 Project URL 到 `NEXT_PUBLIC_SUPABASE_URL`。
5. 复制 Service Role Key 到 `SUPABASE_SERVICE_ROLE_KEY`。
6. 在本地 `.env.local` 和 Vercel Environment Variables 中配置上述变量。

`supabase/schema.sql` 会创建并初始化：

- `candidates`
- `interviewer_evaluations`
- `stages`
- `messages`
- `workspace_messages`
- `event_logs`
- `turn_scores`
- `final_evaluations`
- `agents`
- `job_roles`

## 新数据流

1. 审核员进入 `/admin/candidates/new` 创建候选人。
2. 审核员上传简历并填写多轮面试官评价。
3. 后端调用 DeepSeek 生成 `persona_profile`。
4. 后端生成唯一 `candidate_token` 和 `/candidate/invite/[token]` 专属链接。
5. 候选人只能通过专属链接进入考核。
6. 候选人端所有关键 API 都校验 `candidate_token`。
7. 基础关卡、能力关卡、模型工作区、逐轮追问、逐轮评分、最终评分都调用 DeepSeek 或 OpenAI。
8. 审核员详情页读取 Supabase 中的候选人档案、画像、评价、对话、事件、评分和最终报告。

## Prompt 文件

所有模型 prompt 存放在 `prompts/`：

```text
prompts/persona-profile.deepseek.md
prompts/basic-stage-opening.deepseek.md
prompts/ability-stage-opening.deepseek.md
prompts/follow-up.deepseek.md
prompts/follow-up.openai.md
prompts/turn-score.deepseek.md
prompts/turn-score.openai.md
prompts/workspace-reply.deepseek.md
prompts/workspace-reply.openai.md
prompts/final-evaluation.deepseek.md
prompts/final-evaluation.openai.md
prompts/ability-plan.deepseek.md
prompts/ability-plan.openai.md
```

`lib/prompts.ts` 负责读取 prompt 并替换变量。

## Vercel 部署

1. 将项目推送到 GitHub。
2. 登录 Vercel。
3. 点击 **Add New Project**。
4. 选择 **Import Git Repository**。
5. 选择 GitHub 仓库。
6. Framework Preset 选择或自动识别为 **Next.js**。
7. Build Command：`npm run build`。
8. Output Directory：留空。
9. 添加 Environment Variables。
10. `APP_BASE_URL` 设置为 Vercel 域名，例如：

```text
APP_BASE_URL=https://your-vercel-domain.vercel.app
```

11. 点击 Deploy。

## GitHub 上传

```bash
git add .
git commit -m "update supabase candidate invite flow"
git push origin main
```

## 常见问题

- 如果模型调用失败，API 会返回明确 JSON：`model_call_failed`、`message`、`provider`。
- 如果候选人没有有效 token，不能进入考核 API。
- 如果 Supabase 表为空，请确认已执行 `supabase/schema.sql`。
- 如果 Vercel 页面能打开但没有数据，请检查 Supabase URL、Service Role Key 和 RLS/权限配置。
