import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";

interface LegalPageLayoutProps {
  title: string;
  summary: string;
  children: ReactNode;
}

export default function LegalPageLayout({
  title,
  summary,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />

      <main className="px-4 pb-20 pt-28">
        <div className="mx-auto max-w-4xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="mt-8 rounded-3xl border border-border/60 bg-card/70 p-8 shadow-xl shadow-black/10 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Legal
            </p>
            <h1 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-base text-muted-foreground sm:text-lg">
              {summary}
            </p>

            <div className="mt-8 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-400" />
                <div className="space-y-2 text-sm text-amber-50/90">
                  <p className="font-semibold text-amber-200">Important notice</p>
                  <p>
                    WealthOS Hub is provided for informational and entertainment
                    purposes only. Nothing on this site is financial,
                    investment, tax, accounting, or legal advice, and no
                    fiduciary or advisor-client relationship is created by your
                    use of the service.
                  </p>
                  <p>
                    You should consult licensed professionals before acting on
                    anything you read here. You remain solely responsible for
                    your decisions, trades, and outcomes.
                  </p>
                </div>
              </div>
            </div>

            <div className="prose prose-invert mt-10 max-w-none prose-headings:font-display prose-headings:tracking-tight prose-p:text-muted-foreground prose-li:text-muted-foreground">
              {children}
            </div>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
