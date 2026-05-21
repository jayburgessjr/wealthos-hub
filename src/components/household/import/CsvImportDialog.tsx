import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface CsvField {
  key: string;
  label: string;
  optional?: boolean;
  type?: "string" | "number" | "date";
}

export interface CsvImportDialogProps {
  trigger: React.ReactNode;
  title: string;
  template: { filename: string; headers: string[]; sampleRows: string[][] };
  fields: CsvField[];
  synonyms?: Record<string, string[]>;
  allowDelimiter?: boolean;
  allowDateFormat?: boolean;
  onImport: (
    rows: Record<string, any>[],
    opts: { dateFormat: string },
  ) => Promise<{
    ok: number;
    fail: number;
    errors?: { row: number; reason: string }[];
  }>;
  extraControls?: React.ReactNode;
  presets?: { name: string; aliases: Record<string, string[]> }[];
  storageKey?: string;
}

export function CsvImportDialog(props: CsvImportDialogProps) {
  // Stub: CSV import coming soon
  return null;
}
