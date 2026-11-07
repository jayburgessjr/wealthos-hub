import { useDemo } from "./DemoProvider";
import { Sparkles, X, UserPlus } from "lucide-react";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";

export default function DemoBanner() {
  const { isDemoMode, setDemoMode } = useDemo();

  if (!isDemoMode) return null;

  return (
    <div className="sticky top-0 z-[60] flex w-full items-center justify-between bg-primary px-4 py-2 text-primary-foreground shadow-lg animate-in slide-in-from-top duration-500">
      <div className="flex items-center gap-2 text-xs font-bold">
        <Sparkles size={14} className="animate-pulse" />
        <span>Demo mode: sample data only, nothing is saved</span>
      </div>
      
      <div className="flex items-center gap-4">
        <Button asChild variant="secondary" size="sm" className="h-7 rounded-full bg-white text-primary hover:bg-white/90 text-xs font-bold">
          <Link to="/login" onClick={() => setDemoMode(false)}>
            <UserPlus size={12} className="mr-1" /> Sign in
          </Link>
        </Button>
        <button 
          aria-label="Close demo banner"
          onClick={() => setDemoMode(false)}
          className="rounded-full p-1 hover:bg-black/10 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
