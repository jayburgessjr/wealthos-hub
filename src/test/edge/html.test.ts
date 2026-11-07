// @vitest-environment node
import { describe, expect, it } from "vitest";
import { escapeHtml } from "../../../supabase/functions/_shared/html";

describe("escapeHtml", () => {
  it("escapes markup and quote characters", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(escapeHtml(`" onmouseover='x'`)).toBe("&quot; onmouseover=&#39;x&#39;");
    expect(escapeHtml("Tom & Jerry's `home`")).toBe("Tom &amp; Jerry&#39;s &#96;home&#96;");
  });
  it("handles non-strings and nullish values", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(5)).toBe("5");
  });
  it("is applied in send-household-invite to every interpolated value", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../../supabase/functions/send-household-invite/index.ts", import.meta.url), "utf8");
    expect(src).toContain("escapeHtml(householdName)");
    expect(src).not.toMatch(/<strong>\$\{householdName\}/);
    expect(src).not.toMatch(/href="\$\{acceptUrl\}"/);
    expect(src).not.toMatch(/<code>\$\{acceptUrl\}/);
  });
});
