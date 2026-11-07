// Owner allowlist (DESK_OWNER_EMAIL, comma separated). Pure so it is unit tested.
// Checked at claim time AND on every owner-gated call, so removing an email from the allowlist revokes every desk function
// for that account immediately. (Row access through RLS ends only when the desk_owner row is deleted; see RUNBOOK.)
export type OwnerDenial = "no_email" | "email_unconfirmed" | "allowlist_empty" | "not_allowlisted";

export const OWNER_DENIAL_MESSAGES: Record<OwnerDenial | "owner_cap_reached", string> = {
  no_email: "This account has no email address.",
  email_unconfirmed: "Confirm your email address before claiming the desk.",
  allowlist_empty: "No owner emails are configured (DESK_OWNER_EMAIL is empty).",
  not_allowlisted: "This email address is not on the desk owner allowlist.",
  owner_cap_reached: "The desk already has two owners.",
};

export function parseAllowlist(raw: string | undefined | null): string[] {
  return (raw ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function ownerEligibility(
  user: { email?: string | null; email_confirmed_at?: string | null },
  allowlistRaw: string | undefined | null,
): { ok: true } | { ok: false; reason: OwnerDenial } {
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) return { ok: false, reason: "no_email" };
  const allowed = parseAllowlist(allowlistRaw);
  if (allowed.length === 0) return { ok: false, reason: "allowlist_empty" };
  if (!allowed.includes(email)) return { ok: false, reason: "not_allowlisted" };
  if (!user.email_confirmed_at) return { ok: false, reason: "email_unconfirmed" };
  return { ok: true };
}
