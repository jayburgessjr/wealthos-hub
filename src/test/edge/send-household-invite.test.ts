// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { callerIsOwner, isOwnerRow, type OwnerClient } from "../../../supabase/functions/send-household-invite/owner";

type Row = { user_id: string; household_id: string; role: string };

// Fake client honouring eq filters against an in-memory user_roles table.
function fakeClient(rows: Row[], tables: string[] = []): OwnerClient {
  return {
    from(table: string) {
      tables.push(table);
      return {
        select() {
          const filters: Record<string, string> = {};
          const q = {
            eq(c: string, v: string) { filters[c] = v; return q; },
            limit() { return q; },
            maybeSingle: async () => ({
              data: table === "user_roles"
                ? rows.find((r) => Object.entries(filters).every(([k, v]) => (r as Record<string, string>)[k] === v)) ?? null
                : null,
            }),
          };
          return q;
        },
      };
    },
  };
}

const ROWS: Row[] = [
  { user_id: "owner1", household_id: "hhA", role: "owner" },
  { user_id: "member1", household_id: "hhA", role: "member" },
  { user_id: "owner2", household_id: "hhB", role: "owner" },
];

describe("isOwnerRow", () => {
  it("passes only an owner row", () => {
    expect(isOwnerRow({ role: "owner" })).toBe(true);
    expect(isOwnerRow({ role: "member" })).toBe(false);
    expect(isOwnerRow(null)).toBe(false);
    expect(isOwnerRow(undefined)).toBe(false);
  });
});

describe("callerIsOwner (maps to 403 when false)", () => {
  it("allows the household owner and queries user_roles", async () => {
    const tables: string[] = [];
    expect(await callerIsOwner(fakeClient(ROWS, tables), "owner1", "hhA")).toBe(true);
    expect(tables).toEqual(["user_roles"]);
  });
  it("denies a plain member", async () => {
    expect(await callerIsOwner(fakeClient(ROWS), "member1", "hhA")).toBe(false);
  });
  it("denies a caller with no row", async () => {
    expect(await callerIsOwner(fakeClient(ROWS), "stranger", "hhA")).toBe(false);
  });
  it("denies an owner of a different household", async () => {
    expect(await callerIsOwner(fakeClient(ROWS), "owner2", "hhA")).toBe(false);
  });
});

describe("send-household-invite index.ts", () => {
  const src = readFileSync("supabase/functions/send-household-invite/index.ts", "utf8");
  it("uses user_roles, not household_members", () => {
    expect(src).not.toContain("household_members");
    expect(src).toContain("./owner.ts");
    expect(readFileSync("supabase/functions/send-household-invite/owner.ts", "utf8")).toContain("user_roles");
  });
  it("checks ownership before the status check and before sending", () => {
    const own = src.indexOf("callerIsOwner(supabase");
    expect(own).toBeGreaterThan(-1);
    expect(own).toBeLessThan(src.indexOf('invitation.status !== "pending"'));
    expect(own).toBeLessThan(src.indexOf("api.resend.com"));
  });
  it("still escapes the household name and accept URL", () => {
    expect(src).toContain("escapeHtml(householdName)");
    expect(src).toContain("escapeHtml(acceptUrl)");
  });
});
