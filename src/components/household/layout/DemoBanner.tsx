import { Info } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="mb-3 md:mb-4 border-2 border-yellow-400 bg-yellow-50 text-yellow-800 px-3 py-2 flex items-center gap-2 rounded">
      <Info className="w-4 h-4" />
      <span className="text-xs md:text-sm font-mono">
        Demo mode: changes won't be saved. Create a household to enable saving.
      </span>
    </div>
  );
}
