// ISO-8601 week key ("2026-W27", UTC) — the weekly digest's dedupe component:
// re-running the digest job inside one ISO week enqueues nothing new; the next
// week is a fresh key. ISO weeks start Monday and belong to the year holding
// their Thursday, so the year prefix can differ from the calendar year at the
// boundaries (Jan 1 can be W52/W53 of the prior year; Dec 29+ can be W01).
export function isoWeekKey(date: Date): string {
  // Shift to the week's Thursday: ISO getUTCDay() maps Sunday to 0, so
  // normalize to 1..7 first.
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = thursday.getUTCDay() === 0 ? 7 : thursday.getUTCDay();
  thursday.setUTCDate(thursday.getUTCDate() + 4 - dayOfWeek);
  const isoYear = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}
