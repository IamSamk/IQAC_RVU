import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Null until credentials are configured, so offline demos never fail on it. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
