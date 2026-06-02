import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function one<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Expected one database row, received none.");
  return data;
}

export async function maybeOne<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function many<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function db() {
  return createServerSupabaseClient();
}
