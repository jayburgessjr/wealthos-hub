// Deno-only wiring for _shared/auth.ts. Not imported by Vitest.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { AuthDeps, Env, UserClient } from "./auth.ts";

export const denoEnv: Env = (k) => Deno.env.get(k) ?? undefined;

export function realAuthDeps(): AuthDeps {
  return {
    env: denoEnv,
    makeUserClient: (authHeader: string) =>
      createClient(denoEnv("SUPABASE_URL") ?? "", denoEnv("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }) as unknown as UserClient,
  };
}

/** Service-role client. Only for code paths that have already authenticated the caller as cron (check-alerts). */
export function makeAdminClient(): SupabaseClient {
  return createClient(denoEnv("SUPABASE_URL") ?? "", denoEnv("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
}
