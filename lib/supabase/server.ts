import { createClient } from "@supabase/supabase-js";

export function getSupabaseEnvStatus() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  let supabaseUrlHost: string | null = null;
  let isSupabaseUrlValid = false;

  if (supabaseUrl) {
    try {
      const parsedUrl = new URL(supabaseUrl);
      supabaseUrlHost = parsedUrl.host;
      isSupabaseUrlValid = parsedUrl.protocol === "https:";
    } catch {
      isSupabaseUrlValid = false;
    }
  }

  return {
    hasSupabaseUrl: Boolean(supabaseUrl),
    isSupabaseUrlValid,
    hasServiceRoleKey: Boolean(serviceRoleKey),
    supabaseUrlHost
  };
}

export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
