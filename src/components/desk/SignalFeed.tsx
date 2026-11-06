import { useInstruments, useSignals } from "@/lib/desk/hooks";
import { hostOf, isSafeUrl, shortTime, toNum } from "@/lib/desk/format";
import { NUM, Panel, PanelState } from "./Panel";
import { cn } from "@/lib/utils";

export function SignalFeed() {
  const signals = useSignals();
  const instruments = useInstruments();
  const sym = new Map((instruments.data ?? []).map((i) => [i.id, i.symbol]));

  return (
    <Panel title="Signal feed">
      <PanelState
        isLoading={signals.isLoading || instruments.isLoading}
        error={(signals.error ?? instruments.error) as Error | null}
        onRetry={() => {
          signals.refetch();
          instruments.refetch();
        }}
        isEmpty={(signals.data ?? []).length === 0}
        empty="Agent signals appear here when a scanner or research agent runs."
      >
        <ul>
          {(signals.data ?? []).map((s) => (
            <li key={s.id} className="border-t border-white/10 px-3 py-1.5 first:border-t-0">
              <div className="flex items-baseline gap-2">
                <span className={cn(NUM, "font-semibold text-white")}>{sym.get(s.instrument_id) ?? "?"}</span>
                <span className="capitalize text-white/80">{s.direction}</span>
                <span className={cn(NUM, "text-white/70")}>{(toNum(s.strength) * 100).toFixed(0)}</span>
                <span className="text-white/60">{s.agent_name}</span>
                <span className="ml-auto text-[10px] text-white/50">{shortTime(s.created_at)}</span>
              </div>
              <p className="text-white/80">{s.summary}</p>
              {(s.source_links ?? []).filter((l) => isSafeUrl(l.url)).length > 0 && (
                <p className="mt-0.5 flex flex-wrap gap-x-3">
                  {(s.source_links ?? [])
                    .filter((l) => isSafeUrl(l.url))
                    .map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[hsl(20,82%,51%)] underline underline-offset-2 hover:text-white"
                      >
                        {l.title || hostOf(l.url)}
                      </a>
                    ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      </PanelState>
    </Panel>
  );
}
