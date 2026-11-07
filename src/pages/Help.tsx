import { useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Input } from "@/components/ui/input";
import { AREAS, FAQS, GETTING_STARTED, GLOSSARY, PAGE_GUIDES } from "@/lib/help/content";

const norm = (s: string) => s.toLowerCase();

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="rounded-lg border border-border bg-card p-4">
      <h2 id={`${id}-h`} className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function Help() {
  const [q, setQ] = useState("");
  const needle = norm(q.trim());
  const hit = (...parts: string[]) => needle === "" || parts.some((p) => norm(p).includes(needle));

  const areas = AREAS.filter((a) => hit(a.name, a.tagline, a.what, ...a.useItFor));
  const pages = PAGE_GUIDES.filter((g) => hit(g.title, g.purpose, ...g.howTo));
  const terms = Object.entries(GLOSSARY).filter(([, e]) => hit(e.term, e.short, e.long));
  const faqs = FAQS.filter((f) => hit(f.q, f.a));
  const searching = needle !== "";
  const nothing = searching && !areas.length && !pages.length && !terms.length && !faqs.length;

  return (
    <DashboardLayout>
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
        <header>
          <h1 className="text-lg font-semibold text-foreground">Help and guide</h1>
          <p className="text-xs text-muted-foreground">What each part of the app is for, how to use it, and what the words mean. General information, not financial advice.</p>
        </header>

        <label className="sr-only" htmlFor="help-search">Search help</label>
        <Input id="help-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help: bills, paper trading, emergency fund..." className="h-9" />

        {nothing && <p role="status" className="text-sm text-muted-foreground">Nothing matches that. Try a shorter word.</p>}

        {!searching && (
          <Section id="start" title="Start here">
            <p className="mb-3 text-sm text-muted-foreground">This app is a private workspace for your money. You type in what you earn, own and owe, and it turns that into plain next steps. It never moves money.</p>
            <ol className="flex flex-col gap-2">
              {GETTING_STARTED.map((s, i) => (
                <li key={s.title} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{i + 1}</span>
                  <span>
                    <Link to={s.to} className="font-semibold text-foreground hover:text-primary hover:underline">{s.title}</Link>
                    <span className="block text-muted-foreground">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {areas.length > 0 && (
          <Section id="areas" title="The areas">
            <div className="grid gap-3 md:grid-cols-2">
              {areas.map((a) => (
                <article key={a.id} className="rounded-md border border-border p-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    <Link to={a.path} className="hover:text-primary hover:underline">{a.name}</Link>
                  </h3>
                  <p className="text-xs text-primary">{a.tagline}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{a.what}</p>
                  <ul className="mt-2 list-disc pl-4 text-sm text-foreground/80">
                    {a.useItFor.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                  {a.proOnly && <p className="mt-2 text-xs text-muted-foreground">Shown in the top bar in Pro mode.</p>}
                  {a.ownerOnly && <p className="mt-2 text-xs text-muted-foreground">Visible to the desk owner only. Paper money only.</p>}
                </article>
              ))}
            </div>
          </Section>
        )}

        {pages.length > 0 && (
          <Section id="pages" title="Page by page">
            <div className="flex flex-col divide-y divide-border">
              {pages.map((g) => (
                <article key={g.prefix} className="py-3 first:pt-0 last:pb-0">
                  <h3 className="text-sm font-semibold text-foreground">
                    <Link to={g.prefix} className="hover:text-primary hover:underline">{g.title}</Link>
                  </h3>
                  <p className="text-sm text-muted-foreground">{g.purpose}</p>
                  <ul className="mt-1 list-disc pl-4 text-sm text-foreground/80">
                    {g.howTo.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </Section>
        )}

        {terms.length > 0 && (
          <Section id="glossary" title="Glossary">
            <dl className="grid gap-x-6 gap-y-3 md:grid-cols-2">
              {terms.map(([key, e]) => (
                <div key={key}>
                  <dt className="text-sm font-semibold text-foreground">{e.term}</dt>
                  <dd className="text-sm text-muted-foreground">{e.short} {e.long}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

        {faqs.length > 0 && (
          <Section id="faq" title="Common questions">
            <div className="flex flex-col gap-3">
              {faqs.map((f) => (
                <div key={f.q}>
                  <h3 className="text-sm font-semibold text-foreground">{f.q}</h3>
                  <p className="text-sm text-muted-foreground">{f.a}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </DashboardLayout>
  );
}
