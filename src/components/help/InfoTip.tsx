import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GLOSSARY } from "@/lib/help/content";

/** Small info icon that explains a glossary term on hover, focus or tap. */
export function InfoTip({ term }: { term: string }) {
  const entry = GLOSSARY[term];
  if (!entry) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label={`What is ${entry.term}?`} className="inline-flex align-middle text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-sm">
            <Info className="h-3 w-3" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          <p className="font-semibold">{entry.term}</p>
          <p className="text-muted-foreground">{entry.short}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Wraps any control with a plain hover tooltip. */
export function Hint({ text, children }: { text: string; children: React.ReactElement }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
