import { NextResponse } from "next/server";
import { getSupabaseEnvStatus } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    supabase: getSupabaseEnvStatus(),
    models: {
      hasDeepSeekApiKey: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
      deepSeekModel: process.env.DEEPSEEK_MODEL?.trim() || null,
      hasOpenAiApiKey: Boolean(process.env.OPENAI_API_KEY?.trim()),
      openAiModel: process.env.OPENAI_MODEL?.trim() || null
    },
    app: {
      appBaseUrl: process.env.APP_BASE_URL?.trim() || null,
      nodeEnv: process.env.NODE_ENV || null,
      vercelEnv: process.env.VERCEL_ENV || null
    }
  });
}
