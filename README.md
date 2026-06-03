# AI Cut Arena

AI Cut Arena 是一个面向 AI 产品经理岗位的 AI 闯关考核 MVP。核心流程是：审核官上传简历和面试评价，系统调用大模型生成候选人画像；候选人通过专属链接进入基础关卡和能力关卡；AI 考核官动态出题、追问、评分并记录过程证据；审核官按关卡查看题目、回答、评分、小助手使用记录和关键事件。

## 技术栈

- Next.js 14 App Router
- React 18 + TypeScript
- Supabase Postgres
- DeepSeek Chat Completions API
- OpenAI Chat Completions API
- `mammoth` 解析 DOCX
- `pdfjs-dist` 解析 PDF

## 本地运行

复制环境变量：

```powershell
Copy-Item .env.local.example .env.local
```

填写 `.env.local` 后启动：

```powershell
npm install
npm run dev:local
```

访问：

```text
http://127.0.0.1:3000
```

本地调试详情见 [LOCAL_DEV.md](./LOCAL_DEV.md)。

## 环境变量

```text
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
APP_BASE_URL=http://127.0.0.1:3000
```

不要把 `.env.local` 或真实 API Key 提交到 GitHub。

## 关键接口

```text
POST /api/admin/candidates
POST /api/admin/candidates/[id]/analyze
GET  /api/candidate/invite/[token]
POST /api/candidate/invite/[token]/start
GET  /api/candidates/[id]
POST /api/candidates/[id]/stage/advance
POST /api/candidates/[id]/messages
POST /api/candidates/[id]/workspace-chat
POST /api/candidates/[id]/submit
GET  /api/diagnostics/env
GET  /api/diagnostics/model?provider=deepseek
GET  /api/diagnostics/model?provider=openai
```

## Supabase 初始化

在 Supabase SQL Editor 执行：

```text
supabase/schema.sql
```

如果已有旧数据，建议新建候选人测试完整流程。

## Vercel 部署

Framework Preset：

```text
Next.js
```

Build Command：

```text
npm run build
```

Output Directory：留空。

部署后确认：

```text
/api/diagnostics/env
/api/diagnostics/model?provider=deepseek
/api/diagnostics/model?provider=openai
```

## 常见问题

- 模型没有输出：先访问 `/api/diagnostics/model?provider=deepseek`。
- 页面提示已生成但看不到题目：检查 Supabase `stages` 是否存在多个 `in_progress`，以及 `messages` 是否有 AI 题目。
- 小助手没有回复：检查 `workspace_messages` 是否写入，或看 API 返回的 `model_call_failed`。
- Supabase 无数据：确认 `NEXT_PUBLIC_SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 配置正确。
