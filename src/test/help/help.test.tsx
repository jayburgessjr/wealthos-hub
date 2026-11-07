import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AREAS, FALLBACK_GUIDE, FAQS, GETTING_STARTED, GLOSSARY, PAGE_GUIDES, guideForPath } from "@/lib/help/content";
import { InfoTip } from "@/components/help/InfoTip";
import { PageHelp } from "@/components/help/PageHelp";

vi.mock("@/components/layout/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
import Help from "@/pages/Help";

const SRC = resolve(__dirname, "../..");

describe("help content", () => {
  it("resolves the longest matching prefix and falls back for unknown paths", () => {
    expect(guideForPath("/household/money").title).toBe("Money coach");
    expect(guideForPath("/household/money-out/bills").title).toBe("Money out");
    expect(guideForPath("/household/setup").title).toBe("Household");
    expect(guideForPath("/invs/execute/paper").title).toBe("Paper trading");
    expect(guideForPath("/invs/chart").title).toBe("Invest");
    expect(guideForPath("/desk/research").title).toBe("Desk");
    expect(guideForPath("/nope")).toBe(FALLBACK_GUIDE);
  });

  it("does not match a prefix inside a longer word", () => {
    expect(guideForPath("/homework")).toBe(FALLBACK_GUIDE);
  });

  it("has no empty copy and no em dashes", () => {
    const all = JSON.stringify({ AREAS, GETTING_STARTED, PAGE_GUIDES, GLOSSARY, FAQS });
    expect(all).not.toContain("—");
    for (const g of PAGE_GUIDES) expect(g.howTo.length).toBeGreaterThan(0);
    for (const [k, e] of Object.entries(GLOSSARY)) expect(e.short && e.long && e.term, k).toBeTruthy();
  });

  it("states the safety facts: paper only and not advice", () => {
    const desk = AREAS.find((a) => a.id === "desk")!;
    expect(desk.what.toLowerCase()).toContain("paper");
    expect(GLOSSARY["not-advice"].term.toLowerCase()).toContain("not financial advice");
  });

  it("every InfoTip term used in the source exists in the glossary", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(join(SRC, d), { withFileTypes: true })) {
        if (f.isDirectory()) walk(join(d, f.name));
        else if (/\.tsx$/.test(f.name) && !f.name.includes(".test.")) files.push(join(d, f.name));
      }
    };
    walk("pages");
    walk("components");
    const used = new Set<string>();
    for (const f of files) {
      const text = readFileSync(join(SRC, f), "utf8");
      for (const m of text.matchAll(/(?:tip|term)="([a-z-]+)"/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(0);
    for (const k of used) expect(GLOSSARY[k], `glossary key ${k}`).toBeDefined();
  });

  it("every getting-started link and area path is an app route", () => {
    for (const s of GETTING_STARTED) expect(s.to.startsWith("/")).toBe(true);
    for (const a of AREAS) expect(a.path.startsWith("/")).toBe(true);
  });
});

describe("Help page", () => {
  const renderHelp = () => render(<MemoryRouter><Help /></MemoryRouter>);

  it("shows start here, areas, glossary and questions", () => {
    renderHelp();
    expect(screen.getByRole("heading", { name: "Start here" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The areas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Glossary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Common questions" })).toBeInTheDocument();
  });

  it("search filters sections and shows an empty message", () => {
    renderHelp();
    const box = screen.getByLabelText("Search help");
    fireEvent.change(box, { target: { value: "avalanche" } });
    expect(screen.getByText("Debt avalanche")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Start here" })).toBeNull();
    fireEvent.change(box, { target: { value: "zzzzqqq" } });
    expect(screen.getByRole("status")).toHaveTextContent(/nothing matches/i);
  });
});

describe("tooltips and page help", () => {
  it("InfoTip renders an accessible trigger for a known term and nothing for an unknown one", () => {
    const { container, rerender } = render(<InfoTip term="net-worth" />);
    expect(screen.getByRole("button", { name: /what is net worth/i })).toBeInTheDocument();
    rerender(<InfoTip term="does-not-exist" />);
    expect(container.firstChild).toBeNull();
  });

  it("PageHelp explains the current page and links to the full guide", () => {
    render(
      <MemoryRouter initialEntries={["/household/money"]}>
        <PageHelp />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /how this page works/i }));
    expect(screen.getByText("Money coach")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open the full guide/i })).toHaveAttribute("href", "/help");
  });
});
