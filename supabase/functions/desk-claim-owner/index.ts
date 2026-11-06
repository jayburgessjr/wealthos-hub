// One-time owner claim. The caller must be a confirmed user whose email matches the DESK_OWNER_EMAIL secret.
// After the first claim the single-row desk_owner table makes any other claimant fail.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { adminClient, getEnv, json, optionsResponse } from "../_shared/desk-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return json(req, { ok: false, error: "Method not allowed" }, 405);

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json(req, { ok: false, owner: false, error: "Unauthorized" }, 401);
  const user = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data, error } = await user.auth.getUser();
  if (error || !data.user) return json(req, { ok: false, owner: false, error: "Unauthorized" }, 401);

  const allowed = getEnv("DESK_OWNER_EMAIL").trim().toLowerCase();
  const email = (data.user.email ?? "").trim().toLowerCase();
  if (!allowed || !email || email !== allowed || !data.user.email_confirmed_at) {
    return json(req, { ok: true, owner: false });
  }

  const admin = adminClient();
  const existing = await admin.from("desk_owner").select("user_id").eq("id", true).maybeSingle();
  if (existing.error) return json(req, { ok: false, owner: false, error: "Could not read ownership" }, 500);
  if (existing.data) return json(req, { ok: true, owner: existing.data.user_id === data.user.id });

  const ins = await admin.from("desk_owner").insert({ user_id: data.user.id });
  if (ins.error) return json(req, { ok: true, owner: false });
  await admin.from("desk_risk_events").insert({ event_type: "owner_claimed", actor: "system:desk-claim-owner", details: {} });
  return json(req, { ok: true, owner: true });
});
