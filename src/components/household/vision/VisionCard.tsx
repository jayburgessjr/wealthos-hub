import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pin, Star, Trash2, Link as LinkIcon } from "lucide-react";
import { VisionItem } from "@/hooks/useHouseholdVisionData";

export function VisionCard({
  item,
  onOpen,
  onTogglePin,
  onToggleFav,
  onDelete,
}: {
  item: VisionItem;
  onOpen: () => void;
  onTogglePin: () => void;
  onToggleFav: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="border-2 overflow-hidden group">
      <div className="relative aspect-[4/3] bg-muted">
        {item.url ? (
          <img
            src={item.url}
            alt={item.title || "vision image"}
            className="absolute inset-0 w-full h-full object-cover"
            onClick={onOpen}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Loading…
          </div>
        )}
        <div className="absolute inset-x-0 top-0 p-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant={item.pinned ? "default" : "outline"}
            onClick={onTogglePin}
            className="h-7 w-7"
          >
            <Pin className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant={item.favorite ? "default" : "outline"}
            onClick={onToggleFav}
            className="h-7 w-7"
          >
            <Star className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={onOpen}
            className="h-7 w-7"
          >
            <LinkIcon className="h-3 w-3" />
          </Button>
          <div className="ml-auto" />
          <Button
            size="icon"
            variant="destructive"
            onClick={onDelete}
            className="h-7 w-7"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="p-2">
        <div className="text-sm font-medium truncate" title={item.title || ""}>
          {item.title || "Untitled"}
        </div>
        {item.tags?.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="text-[10px] font-mono px-1 py-[1px] border"
              >
                #{t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
