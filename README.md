# AI Cut Arena

AI Cut Arena 是一个面向 AI 产品经理岗位的 AI 闯关考核 MVP。

当前版本采用小闭环流程：

1. 审核员创建候选人档案，上传简历并填写多轮面试评价。
2. 后端调用 DeepSeek 生成人物画像。
3. 系统生成候选人专属链接。
4. 候选人通过专属链接进入面试准备、基础关卡和能力关卡。
5. 基础关卡和能力关卡由 DeepSeek/OpenAI 根据候选人画像、岗位难度、能力维度和 Agent 参与策略动态生成题目。
6. 候选人可在模型交互工作区调用 DeepSeek/OpenAI 辅助思考，过程会留痕。
7. 每轮正式回答会调用模型评分、生成追问，并记录关键事件。
8. 审核员查看候选人全过程证据、评分和最终报告。

## 技术栈

- Next.js 14 App Router
- React 18 + TypeScript
- Supabase Postgres
- DeepSeek Chat Completions API
- OpenAI Chat Completions API
- `mammoth` 解析 DOCX
- `pdfjs-dist` 解析 PDF

## 项目结构

```text
.
├─ app/
│  ├─ admin/                 # 审核员页面
│  ├─ candidate/             # 候选人页面
│  ├─ api/                   # Next.js 后端 API Routes
│  ├─ components/            # 共享 UI 组件
│  ├─ AppHeader.tsx
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ lib/
│  ├─ repositories/          # Supabase 数据访问层
│  ├─ supabase/              # Supabase server client
│  ├─ ai.ts                  # 业务级 AI 调用封装
│  ├─ apiUtils.ts            # API 错误与 token 校验
│  ├─ jobConfig.ts           # 岗位默认配置
│  ├─ modelClients.ts        # DeepSeek/OpenAI 底层调用
│  ├─ prompts.ts             # Prompt 文件读取和变量替换
│  ├─ stages.ts              # 关卡定义、计时规则
│  └─ types.ts               # 业务类型
├─ prompts/                  # 独立 Prompt 文件
├─ supabase/
│  └─ schema.sql             # 数据库建表和初始 Agent/岗位配置
├─ types/
├─ .env.example
├─ .gitignore
├─ next.config.mjs
├─ package.json
└─ tsconfig.json
```

## 关键后端接口

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

## Prompt 文件

所有模型 prompt 均放在 `prompts/`，代码不再内联长 prompt：

```text
persona-profile.deepseek.md
ability-plan.deepseek.md
ability-plan.openai.md
basic-stage-opening.deepseek.md
ability-stage-opening.deepseek.md
follow-up.deepseek.md
follow-up.openai.md
turn-score.deepseek.md
turn-score.openai.md
workspace-reply.deepseek.md
workspace-reply.openai.md
final-evaluation.deepseek.md
final-evaluation.openai.md
```

## 环境变量

复制 `.env.example` 为 `.env.local`：

```text
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
APP_BASE_URL=http://localhost:3000
```

注意：

- `SUPABASE_SERVICE_ROLE_KEY` 只能用于服务端，不能暴露到前端。
- 不要把真实 API Key 提交到 GitHub。
- 不再使用 `DS-key.txt` 或 `chat_key.txt`。
- 生产环境不使用本地 JSON 数据文件，全部数据写入 Supabase。

## 本地运行

```bash
npm install
npm run dev
```

访问：

```text
http://localhost:3000
```

构建：

```bash
npm run build
```

## Supabase 初始化

1. 创建 Supabase Project。
2. 打开 SQL Editor。
3. 执行 `supabase/schema.sql`。
4. 复制 Project URL 到 `NEXT_PUBLIC_SUPABASE_URL`。
5. 复制 Secret key / service role key 到 `SUPABASE_SERVICE_ROLE_KEY`。
6. 在 Vercel Environment Variables 中配置所有环境变量。

## Vercel 部署

Framework Preset：

```text
Next.js
```

Build Command：

```text
npm run build
```

Output Directory：

```text
留空
```

部署后确认：

```text
/api/diagnostics/env
/api/diagnostics/model?provider=deepseek
/api/diagnostics/model?provider=openai
```

如果项目开启了 Vercel Deployment Protection，需要在已登录 Vercel 的浏览器中访问诊断接口。

## GitHub 上传

```bash
git add .
git commit -m "update ai cut arena"
git push origin main
```

## 清理规则

项目根目录不应存在：

```text
DS-key.txt
chat_key.txt
data/store.json
*.pdf
*.doc
*.docx
```

这些文件属于本地密钥、旧本地存储或测试资料，不参与部署。

## 常见问题

- 如果页面提示 `model_call_failed`，查看返回的 `message` 和 `provider`。
- 如果候选人点击生成题目后没有题，查看 `/api/candidates/[id]/stage/advance` 的 Vercel Runtime Logs。
- 如果右侧模型工作区没有回复，先访问 `/api/diagnostics/model?provider=deepseek` 验证模型 Key 和模型名。
- 如果 Supabase 没有数据，确认已经执行 `supabase/schema.sql`，并确认 `SUPABASE_SERVICE_ROLE_KEY` 是 secret/service role key。
