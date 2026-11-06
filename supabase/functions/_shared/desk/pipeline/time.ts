// Trading-date helper. America/New_York calendar date as YYYY-MM-DD.
export function etDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
