// Owner-only kill switch reset. The database function re-checks ownership, rebases the high-water mark and logs the event.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { json, optionsResponse, readJson, requireOwner } from "../_shared/desk-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return json(req, { ok: false, error: "Method not allowed" }, 405);
  const ctx = await requireOwner(req);
  if (ctx instanceof Response) return ctx;

  const body = await readJson<{ note?: unknown }>(req);
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";
  if (note.length < 10) return json(req, { ok: false, error: "Add a note of at least 10 characters explaining why trading can resume." }, 400);

  const { error } = await ctx.user.rpc("desk_reset_kill_switch", { p_note: note });
  if (error) return json(req, { ok: false, error: "Reset was refused." }, 403);
  return json(req, { ok: true });
});
