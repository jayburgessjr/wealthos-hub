// Desk state sync: day roll and high-water mark. No broker import, so read-only jobs can use it.
import type { DeskRepo, DeskState } from "./repo.ts";
import { etDate } from "./time.ts";

/** Initialise or roll day-start equity (prior snapshot becomes today's start) and ratchet the high-water mark. */
export async function syncState(repo: DeskRepo, equity: number, now: Date): Promise<DeskState> {
  const s = await repo.getState();
  const today = etDate(now);
  const patch: Partial<DeskState> = { lastEquity: equity };
  if (!(s.highWaterMark > 0) || equity > s.highWaterMark) patch.highWaterMark = equity;
  if (s.dayStartDate !== today) {
    patch.dayStartEquity = s.lastEquity > 0 ? s.lastEquity : equity;
    patch.dayStartDate = today;
  } else if (!(s.dayStartEquity > 0)) {
    patch.dayStartEquity = equity;
  }
  await repo.patchState(patch);
  return { ...s, ...patch };
}
