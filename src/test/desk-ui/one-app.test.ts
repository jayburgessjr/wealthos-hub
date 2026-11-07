import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("Invest, Wealth, Household and Desk share one look", () => {
  it("no area overrides the app accent color", () => {
    const css = read("index.css");
    expect(css).not.toMatch(/^\.household\b/m);
    expect(css).not.toMatch(/^\.wealth\b/m);
    expect(css).not.toMatch(/\.dark \.(household|wealth)\b/);
  });

  it("the layout does not switch theme class by area", () => {
    const layout = read("components/layout/DashboardLayout.tsx");
    expect(layout).not.toMatch(/household|wealth/);
  });

  it("the top-bar area pills and sidebar labels use one color each, not one per area", () => {
    const nav = read("components/layout/Navbar.tsx");
    expect(nav).not.toMatch(/blue-600\/15|amber-500\/15|emerald-600\/15|orange-500\/15/);
    // Home plus the four areas (Invest, Wealth, Household, Desk) all use the same active style
    expect(nav.match(/\? "bg-primary\/15 text-primary"/g)?.length).toBeGreaterThanOrEqual(5);
    const side = read("components/layout/Sidebar.tsx");
    expect(side).not.toMatch(/text-(emerald|amber|orange)-500\/50/);
  });

  it("no file references removed names (ORANGE_*) or uses ChevronRight without importing it", () => {
    for (const f of readdirSync(join(SRC, "components/desk"))) {
      if (/\.tsx?$/.test(f)) expect(read(join("components/desk", f)), f).not.toMatch(/ORANGE_(TEXT|BG)/);
    }
    const bar = read("components/layout/RightBar.tsx");
    expect(bar).toMatch(/import \{[^}]*\bChevronRight\b[^}]*\} from "lucide-react"/s);
  });

  it("the Desk uses theme tokens only: no hardcoded white or accent hsl values", () => {
    const files: string[] = [];
    for (const dir of ["components/desk", "pages/desk", "lib/desk"]) {
      for (const f of readdirSync(join(SRC, dir))) if (/\.tsx?$/.test(f)) files.push(join(dir, f));
    }
    const offenders = files.filter((f) => /text-white|border-white|bg-white|hsl\(20|hsl\(240,6%/.test(read(f)));
    expect(offenders).toEqual([]);
  });
});
