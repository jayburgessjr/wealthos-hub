import { format as dfFormat, parseISO } from "date-fns";

export function formatCurrency(
  value: number,
  options?: { currency?: string; minimumFractionDigits?: number },
) {
  const { currency = "USD", minimumFractionDigits = 0 } = options || {};
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits,
      maximumFractionDigits: Math.max(0, minimumFractionDigits),
    }).format(value);
  } catch {
    // Fallback
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);
    return `${sign}$${abs.toLocaleString(undefined, { minimumFractionDigits, maximumFractionDigits: Math.max(0, minimumFractionDigits) })}`;
  }
}

export function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

export function formatDateISOToLong(isoDate: string) {
  const d = parseISO(isoDate);
  return dfFormat(d, "EEEE, MMMM d");
}

export function formatDateISO(isoDate: string, fmt = "yyyy-MM-dd") {
  return dfFormat(parseISO(isoDate), fmt);
}

// Trend helpers
export function trendTone(
  percent: number,
): "danger" | "warning" | "default" | "success" | "info" {
  if (percent >= 90) return "danger";
  if (percent >= 75) return "warning";
  return "default";
}

// Month helpers
export function monthToLabel(monthISO: string) {
  // monthISO: YYYY-MM
  const d = parseISO(`${monthISO}-01`);
  return dfFormat(d, "MMMM yyyy");
}
