import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function VisionUpload({
  onFiles,
}: {
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      className={`border-2 border-dashed p-4 text-center ${dragOver ? "bg-muted/50" : "bg-card"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length) onFiles(files);
      }}
    >
      <p className="text-sm text-muted-foreground">Drag & drop images here</p>
      <div className="mt-2">
        <Button
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="font-mono text-xs"
        >
          Browse
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? []);
            if (fs.length) onFiles(fs);
          }}
        />
      </div>
    </div>
  );
}
