import { supabase } from "@/integrations/supabase/client";

/**
 * Typed wrapper for the household membership RPCs (migration 20261111000000_tenancy_hardening.sql).
 * types.ts is generated and not hand-edited, so the RPC names/args are cast here until it is regenerated.
 *
 * Deploy compatibility: the frontend may ship before the migration is applied. Only when the RPC does not exist
 * ("function not found" signals) the legacy client write runs; every other error is rethrown unchanged so
 * authorization failures (not_a_member, not_owner, last_owner, 42501) are never masked or retried via the legacy path.
 */
export type MembershipRpcName =
  | "accept_invitation"
  | "switch_active_household"
  | "set_member_role"
  | "remove_member";

interface RpcErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

export function isRpcMissing(err: unknown, status?: number | null): boolean {
  if (status === 404) return true;
  if (!err || typeof err !== "object") return false;
  const e = err as RpcErrorLike;
  if (e.status === 404) return true;
  if (e.code === "PGRST202" || e.code === "42883") return true;
  return /Could not find the function/i.test(e.message ?? "");
}

// RPC name -> false once the server reported it missing (remembered for the session).
const rpcAvailable = new Map<MembershipRpcName, boolean>();

/** Test hook: forget which RPCs were found missing. */
export function resetMembershipRpcMemo(): void {
  rpcAvailable.clear();
}

export async function callMembershipRpc<T>(
  name: MembershipRpcName,
  args: Record<string, unknown>,
  legacy: () => Promise<T>,
): Promise<T> {
  if (rpcAvailable.get(name) === false) return legacy();
  const rpc = supabase.rpc as unknown as (
    fn: string,
    a: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown; status?: number }>;
  const { data, error, status } = await rpc.call(supabase, name, args);
  if (error) {
    if (isRpcMissing(error, status)) {
      rpcAvailable.set(name, false);
      return legacy();
    }
    throw error;
  }
  return data as T;
}

/** Plain-English message for the fixed error codes the RPCs raise; falls back to the server message. */
export function membershipErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as RpcErrorLike | null)?.message ?? "";
  if (msg.includes("invitation_unavailable"))
    return "This invitation is not available for your account. Sign in with the invited, verified email address.";
  if (msg.includes("last_owner")) return "A household must keep at least one owner.";
  if (msg.includes("not_owner")) return "Only a household owner can do that.";
  if (msg.includes("not_a_member")) return "You are not a member of that household.";
  return msg || fallback;
}
