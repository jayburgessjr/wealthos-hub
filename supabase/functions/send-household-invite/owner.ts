// Pure household-ownership decision for send-household-invite. No Deno-only imports.
// Membership lives in public.user_roles (user_id, household_id, role in 'owner'|'member').

export interface RoleRow {
  role?: string | null;
}

export function isOwnerRow(row: RoleRow | null | undefined): boolean {
  return !!row && row.role === "owner";
}

// Minimal structural type for the supabase-js query chain used here.
interface OwnerQuery {
  eq(column: string, value: string): OwnerQuery;
  limit(n: number): OwnerQuery;
  maybeSingle(): PromiseLike<{ data: RoleRow | null }>;
}
export interface OwnerClient {
  from(table: string): { select(columns: string): OwnerQuery };
}

export async function callerIsOwner(
  client: OwnerClient,
  userId: string,
  householdId: string,
): Promise<boolean> {
  const { data } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("household_id", householdId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  return isOwnerRow(data);
}
