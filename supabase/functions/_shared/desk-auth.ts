// Auth and HTTP helpers for Desk edge functions (Deno only).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) ?? "";

export function corsHeaders(req: Request): Record<string, string> {
  const allowed = env("APP_URL");
  const origin = req.headers.get("origin") ?? "";
  // Desk functions are called only from the app. Never reflect an arbitrary origin; never use "*".
  const allow = allowed && origin === allowed ? origin : allowed || "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}

export const adminClient = (): SupabaseClient => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

export interface OwnerCtx {
  userId: string;
  email: string | null;
  /** Client acting as the owner (RLS applies, auth.uid() is the owner). */
  user: SupabaseClient;
  /** Service-role client. Never hand this to agent code paths. */
  admin: SupabaseClient;
}

/** Verifies the caller's JWT and that they are the claimed desk owner. Returns a Response on failure. */
export async function requireOwner(req: Request): Promise<OwnerCtx | Response> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json(req, { ok: false, error: "Unauthorized" }, 401);
  const user = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data, error } = await user.auth.getUser();
  if (error || !data.user) return json(req, { ok: false, error: "Unauthorized" }, 401);
  const { data: isOwner, error: rpcErr } = await user.rpc("is_desk_owner");
  if (rpcErr || isOwner !== true) return json(req, { ok: false, error: "Not available" }, 403);
  return { userId: data.user.id, email: data.user.email ?? null, user, admin: adminClient() };
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Cron callers present x-cron-secret. Returns a Response on failure, or true. */
export function requireCron(req: Request): true | Response {
  const expected = env("DESK_CRON_SECRET");
  const got = req.headers.get("x-cron-secret") ?? "";
  if (!expected || !got || !safeEqual(expected, got)) return json(req, { ok: false, error: "Unauthorized" }, 401);
  return true;
}

export const optionsResponse = (req: Request) => new Response(null, { status: 204, headers: corsHeaders(req) });

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export const getEnv = env;
