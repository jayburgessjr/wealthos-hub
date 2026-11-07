import { Lock } from "lucide-react";

export default function PrivateAccess() {
  return (
    <section id="private" className="py-16 md:py-24">
      <div className="container px-4">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border/50 bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Private, for friends and family
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            This app is not open to the public. It is built for people Jay has invited, and
            everything in it is open to everyone invited. Your data is yours and stays private to
            your account.
          </p>
        </div>
      </div>
    </section>
  );
}
