// Owner allowlist (DESK_OWNER_EMAIL, comma separated). Pure so it is unit tested.
// Checked at claim time AND on every owner-gated call, so removing an email from the allowlist revokes every desk function
// for that account immediately. (Row access through RLS ends only when the desk_owner row is deleted; see RUNBOOK.)
export type OwnerDenial = "no_email" | "email_unconfirmed" | "not_allowlisted";

export const OWNER_DENIAL_MESSAGES: Record<OwnerDenial | "owner_cap_reached", string> = {
  no_email: "This account has no email address.",
  email_unconfirmed: "Confirm your email address before claiming the desk.",
  not_allowlisted: "This account is not eligible for the desk.",
  owner_cap_reached: "The desk already has two owners.",
};

export function parseAllowlist(raw: string | undefined | null): string[] {
  return (raw ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/**
 * Order matters: email confirmation is tested BEFORE the allowlist so an unconfirmed account cannot learn whether an
 * address is allowlisted. An empty allowlist and a non-member return the same public reason; `internal` carries the
 * specific cause for server-side logs only and must never be sent to the client.
 */
export function ownerEligibility(
  user: { email?: string | null; email_confirmed_at?: string | null },
  allowlistRaw: string | undefined | null,
): { ok: true } | { ok: false; reason: OwnerDenial; internal: "no_email" | "email_unconfirmed" | "allowlist_empty" | "not_allowlisted" } {
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) return { ok: false, reason: "no_email", internal: "no_email" };
  if (!user.email_confirmed_at) return { ok: false, reason: "email_unconfirmed", internal: "email_unconfirmed" };
  const allowed = parseAllowlist(allowlistRaw);
  if (allowed.length === 0) return { ok: false, reason: "not_allowlisted", internal: "allowlist_empty" };
  if (!allowed.includes(email)) return { ok: false, reason: "not_allowlisted", internal: "not_allowlisted" };
  return { ok: true };
}
