# 本地全栈调试说明

这个项目是 Next.js App Router 项目，本地运行 `next dev` 时，前端页面和后端 API Routes 会一起启动。

## 1. 准备环境变量

复制示例文件：

```powershell
Copy-Item .env.local.example .env.local
```

然后把 `.env.local` 填成你的真实配置：

```text
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SERVICE_ROLE_KEY=Supabase Secret key 或 service_role key
DEEPSEEK_API_KEY=你的 DeepSeek Key
DEEPSEEK_MODEL=deepseek-chat
OPENAI_API_KEY=你的 OpenAI Key
OPENAI_MODEL=gpt-4o-mini
APP_BASE_URL=http://127.0.0.1:3000
```

注意：`.env.local` 不会提交到 GitHub。

## 2. 启动本地后端和前端

```powershell
npm install
npm run dev:local
```

打开：

```text
http://127.0.0.1:3000
```

## 3. 先检查环境变量是否被本地服务读取

浏览器打开：

```text
http://127.0.0.1:3000/api/diagnostics/env
```

需要看到：

```json
{
  "supabase": {
    "hasSupabaseUrl": true,
    "isSupabaseUrlValid": true,
    "hasServiceRoleKey": true
  },
  "models": {
    "hasDeepSeekApiKey": true,
    "hasOpenAiApiKey": true
  }
}
```

## 4. 检查模型是否真的能调用

DeepSeek：

```text
http://127.0.0.1:3000/api/diagnostics/model?provider=deepseek
```

OpenAI：

```text
http://127.0.0.1:3000/api/diagnostics/model?provider=openai
```

如果返回 `ok: true`，说明本地后端已经真实调用到模型。

如果返回 `model_call_failed` 或 `ok: false`，优先检查：

- API Key 是否填错。
- 模型名是否可用。
- 账户余额或额度是否正常。
- 当前网络是否能访问对应模型接口。

## 5. 本地跑完整流程

1. 访问 `http://127.0.0.1:3000/admin/login`。
2. 进入审核端，新建候选人。
3. 上传简历，填写面试官评价。
4. 生成人物画像和专属链接。
5. 用专属链接进入候选人端。
6. 点击“生成基础关卡首题”。
7. 用右下角 AI 小助手提问，确认能返回模型回复。
8. 提交正式回应，确认评分表和追问生成。

## 6. Supabase 需要确认的表

本地仍然连接同一个 Supabase 项目。调试时重点看这些表：

```text
candidates
stages
messages
workspace_messages
event_logs
turn_scores
final_evaluations
```

如果页面显示“已生成”但看不到内容，优先检查：

- `stages` 是否有多个 `in_progress`。
- `messages` 是否有对应 candidate_id 的 AI 题目。
- `workspace_messages` 是否有模型助手回复。
- `event_logs` 是否出现 `stage_question_generation_failed`。

## 7. 常见本地问题

如果端口被占用：

```powershell
npm run dev:local -- -p 3001
```

如果 `.env.local` 改了但服务没生效，重启 dev server。

如果 Supabase SQL 刚更新，建议新建一个候选人重新测，不要用旧的候选人链路判断新逻辑。
