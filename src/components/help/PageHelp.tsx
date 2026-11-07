import { CircleHelp } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { guideForPath } from "@/lib/help/content";

/** Top-bar button: explains the page you are on, then links to the full Help page. */
export function PageHelp() {
  const { pathname } = useLocation();
  const g = guideForPath(pathname);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="How this page works" className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-primary">
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How this page works</p>
        <h3 className="mt-1 font-semibold text-foreground">{g.title}</h3>
        <p className="text-muted-foreground">{g.purpose}</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-foreground/80">
          {g.howTo.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <Link to="/help" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">
          Open the full guide
        </Link>
      </PopoverContent>
    </Popover>
  );
}
