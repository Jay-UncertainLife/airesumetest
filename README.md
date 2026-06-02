# AI Cut Arena

AI Cut Arena is a Next.js MVP for AI-driven candidate assessment. It supports candidate resume ingestion, AI product manager role assessment, dynamic stage questions, DS/OpenAI model workspaces, event logging, turn scoring, reviewer reports, agent management, and job configuration.

## Tech Stack

- Next.js 14 App Router
- React 18
- TypeScript
- CSS in `app/globals.css`
- Serverless API routes in `app/api`
- Local JSON store for development
- In-memory serverless fallback for Vercel demo deployment

## Project Structure

```text
app/
  api/                 # Server-side API routes
  admin/               # Reviewer and admin pages
  candidate/           # Candidate flow pages
  components/          # Shared UI components
  layout.tsx
  page.tsx
  globals.css
lib/                   # Domain models, AI calls, local store, scoring logic
types/                 # Local type declarations
data/                  # Local development data directory
```

## Local Development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Build

```bash
npm run build
```

## Environment Variables

Create `.env.local` locally, or configure these in Vercel:

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
```

Do not commit real API keys. The app reads AI keys only from server-side environment variables. Local fallback files `DS-key.txt` and `chat_key.txt` are ignored by Git and should not be uploaded.

## GitHub Upload

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Vercel Deployment

1. Log in to Vercel.
2. Click **Add New Project**.
3. Select **Import Git Repository**.
4. Choose this GitHub repository.
5. Framework Preset should auto-detect as **Next.js**.
6. Build Command: `npm run build`.
7. Output Directory: leave empty for Next.js.
8. Add the Environment Variables listed above.
9. Click **Deploy**.

## Notes and Common Issues

- If local development shows `Cannot find module '../xxx.js'` from `.next`, stop the dev server and delete `.next`:

```powershell
Remove-Item -Recurse -Force .next
npm.cmd run dev
```

- Vercel serverless deployments do not persist writes to local files. This MVP uses an in-memory fallback on Vercel so it can deploy and run as a demo. For production, replace `lib/store.ts` with a persistent database such as Vercel Postgres, Supabase, Neon, or Redis.

- PDF parsing uses `pdfjs-dist`; DOCX parsing uses `mammoth`.
