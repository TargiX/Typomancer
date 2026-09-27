import { getLocalDateKey, type RunRecord } from './playerProgress.ts';

/** Seven local calendar days, including today. Missing days are not zero scores. */
export function getWeeklyProgress(runs: RunRecord[], now = new Date(), practiceDates: string[] = [], metricRuns = runs) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = getLocalDateKey(date);
    const seen = new Set<string>();
    const items = runs.filter(run => {
      const ended = new Date(run.endedAt);
      if (!Number.isFinite(ended.getTime()) || ended > now || getLocalDateKey(ended) !== key || seen.has(run.id)) return false;
      seen.add(run.id);
      return Number.isFinite(run.wpm) && Number.isFinite(run.accuracy);
    });
    const comparable = items.filter(run => metricRuns.some(m => m.id === run.id));
    return { ...(practiceDates.length ? { practiced: practiceDates.includes(key) } : {}), date: key, count: items.length,
      wpm: comparable.length ? comparable.reduce((sum, run) => sum + run.wpm, 0) / comparable.length : null,
      accuracy: comparable.length ? comparable.reduce((sum, run) => sum + run.accuracy, 0) / comparable.length : null };
  });
}
