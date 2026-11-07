import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a) } }));

import {
  callMembershipRpc, isRpcMissing, resetMembershipRpcMemo, membershipErrorMessage,
} from "@/integrations/supabase/membership-rpc";
import {
  acceptInvitation, switchActiveHousehold, updateMemberRole, removeMemberFromHousehold,
} from "@/integrations/supabase/household-queries";

const missing = { code: "PGRST202", message: "Could not find the function public.x in the schema cache" };

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
  resetMembershipRpcMemo();
});

describe("isRpcMissing", () => {
  it.each([
    [{ code: "PGRST202" }, undefined],
    [{ code: "42883" }, undefined],
    [{ message: "Could not find the function public.remove_member(p_user_id) in the schema cache" }, undefined],
    [{ message: "boom" }, 404],
    [{ status: 404 }, undefined],
  ])("treats %j (status %s) as missing", (err, status) => {
    expect(isRpcMissing(err, status as number | undefined)).toBe(true);
  });
  it.each([
    [{ code: "42501", message: "not_a_member" }],
    [{ code: "P0001", message: "last_owner" }],
    [{ code: "23505" }],
    [null],
    ["string"],
  ])("does not treat %j as missing", (err) => {
    expect(isRpcMissing(err, 400)).toBe(false);
  });
});

describe("callMembershipRpc", () => {
  it("returns the RPC result and never runs the legacy write when the RPC exists", async () => {
    rpc.mockResolvedValue({ data: "hid-1", error: null });
    const legacy = vi.fn();
    expect(await callMembershipRpc("accept_invitation", { p_token: "t" }, legacy)).toBe("hid-1");
    expect(rpc).toHaveBeenCalledWith("accept_invitation", { p_token: "t" });
    expect(legacy).not.toHaveBeenCalled();
  });

  it.each([
    ["PGRST202", { error: missing }],
    ["42883", { error: { code: "42883", message: "function does not exist" } }],
    ["404 status", { error: { message: "Not Found" }, status: 404 }],
    ["message form", { error: { message: "Could not find the function public.x" } }],
  ])("falls back to legacy once and remembers it for the session (%s)", async (_n, res) => {
    rpc.mockResolvedValue({ data: null, ...res });
    const legacy = vi.fn().mockResolvedValue("legacy");
    expect(await callMembershipRpc("switch_active_household", {}, legacy)).toBe("legacy");
    expect(legacy).toHaveBeenCalledTimes(1);
    expect(await callMembershipRpc("switch_active_household", {}, legacy)).toBe("legacy");
    expect(legacy).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledTimes(1); // second call skipped the RPC
  });

  it.each([
    [{ code: "P0001", message: "last_owner" }],
    [{ code: "42501", message: "not_a_member" }],
    [{ code: "42501", message: "insufficient privilege" }],
    [{ code: "PGRST301", message: "JWT expired" }],
  ])("rethrows %j unchanged and never calls legacy", async (err) => {
    rpc.mockResolvedValue({ data: null, error: err });
    const legacy = vi.fn();
    await expect(callMembershipRpc("set_member_role", {}, legacy)).rejects.toBe(err);
    expect(legacy).not.toHaveBeenCalled();
    // not remembered as missing: next call still tries the RPC
    rpc.mockResolvedValue({ data: null, error: null });
    await callMembershipRpc("set_member_role", {}, legacy);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(legacy).not.toHaveBeenCalled();
  });

  it("memoises per RPC name independently", async () => {
    rpc.mockImplementation(async (name: string) =>
      name === "remove_member" ? { data: null, error: missing } : { data: null, error: null },
    );
    const legacyRemove = vi.fn().mockResolvedValue(undefined);
    const legacySwitch = vi.fn();
    await callMembershipRpc("remove_member", {}, legacyRemove);
    await callMembershipRpc("switch_active_household", {}, legacySwitch);
    expect(legacyRemove).toHaveBeenCalledTimes(1);
    expect(legacySwitch).not.toHaveBeenCalled();
  });

  it("does not fall back when the legacy-missing RPC later exists in a fresh session", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: missing });
    const legacy = vi.fn().mockResolvedValue("l");
    await callMembershipRpc("accept_invitation", {}, legacy);
    resetMembershipRpcMemo(); // page reload after the migration was applied
    rpc.mockResolvedValue({ data: "h", error: null });
    expect(await callMembershipRpc("accept_invitation", {}, legacy)).toBe("h");
    expect(legacy).toHaveBeenCalledTimes(1);
  });
});

describe("household-queries wiring", () => {
  it("uses the four RPCs with the contract argument names and performs no table write", async () => {
    rpc.mockResolvedValue({ data: "hid", error: null });
    expect(await acceptInvitation("tok", "u1")).toEqual({ householdId: "hid" });
    await switchActiveHousehold("u1", "h1");
    await updateMemberRole("u2", "h1", "owner");
    await removeMemberFromHousehold("u2", "h1");
    expect(rpc.mock.calls).toEqual([
      ["accept_invitation", { p_token: "tok" }],
      ["switch_active_household", { p_household_id: "h1" }],
      ["set_member_role", { p_household_id: "h1", p_user_id: "u2", p_role: "owner" }],
      ["remove_member", { p_household_id: "h1", p_user_id: "u2" }],
    ]);
    expect(from).not.toHaveBeenCalled();
  });

  it("runs the legacy table writes only when the RPC is missing", async () => {
    rpc.mockResolvedValue({ data: null, error: missing });
    const chain: Record<string, unknown> = {};
    const result = { error: null, data: null };
    for (const m of ["update", "eq", "delete", "upsert"]) chain[m] = vi.fn(() => chain);
    (chain as { then: unknown }).then = (res: (v: unknown) => void) => res(result);
    from.mockReturnValue(chain);
    await switchActiveHousehold("u1", "h1");
    expect(from).toHaveBeenCalledWith("profiles");
    await updateMemberRole("u2", "h1", "member");
    expect(from).toHaveBeenCalledWith("user_roles");
  });

  it("a last_owner refusal is surfaced, not retried through the legacy write", async () => {
    const err = { code: "P0001", message: "last_owner" };
    rpc.mockResolvedValue({ data: null, error: err });
    await expect(updateMemberRole("u1", "h1", "member")).rejects.toBe(err);
    expect(from).not.toHaveBeenCalled();
  });
});

describe("membershipErrorMessage", () => {
  it("maps the fixed codes and falls back", () => {
    expect(membershipErrorMessage({ message: "last_owner" }, "x")).toMatch(/at least one owner/);
    expect(membershipErrorMessage({ message: "not_owner" }, "x")).toMatch(/owner/);
    expect(membershipErrorMessage({ message: "not_a_member" }, "x")).toMatch(/not a member/);
    expect(membershipErrorMessage({ message: "invitation_unavailable" }, "x")).toMatch(/verified email/);
    expect(membershipErrorMessage({ message: "other" }, "x")).toBe("other");
    expect(membershipErrorMessage(null, "fallback")).toBe("fallback");
  });
});

describe("static: no client write to membership outside *Legacy functions", () => {
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  const files = walk(resolve(__dirname, "../..")).filter(
    (p) => /\.(ts|tsx)$/.test(p) && !p.includes("/test/") && !/\.test\./.test(p),
  );

  it("user_roles is never written, and profiles.household_id is never written, except in *Legacy functions", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const re = /\.from\(\s*["'](user_roles|profiles)["']\s*\)/g;
      for (const m of src.matchAll(re)) {
        const tail = src.slice(m.index!, m.index! + 260);
        const writes = /\.(insert|upsert|update|delete)\(/.test(tail);
        if (!writes) continue;
        if (m[1] === "profiles" && !/household_id/.test(tail)) continue;
        const before = src.slice(0, m.index!);
        const fn = [...before.matchAll(/function\s+(\w+)/g)].pop()?.[1] ?? "";
        if (!fn.endsWith("Legacy")) offenders.push(`${f.split("/src/")[1]}: ${m[1]} in ${fn || "?"}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
