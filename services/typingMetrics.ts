/** Physical typing measurements, independent of shields, perks and story rewards. */
export interface CadenceMeasurement { count: number; sumMs: number; sumSquaresMs: number }
export interface TypingMeasurement {
  cadence?: CadenceMeasurement;
  characters: number;
  mistakes: number;
  attempts: number;
  durationMs: number;
}

export const measuredWpm = (characters: number, durationMs: number): number => (
  durationMs > 0 ? Math.max(0, characters) * 12_000 / Math.max(1_000, durationMs) : 0
);

export const measuredAccuracy = (mistakes: number, attempts: number): number => (
  attempts > 0 ? Math.max(0, 100 * (1 - Math.max(0, mistakes) / attempts)) : 100
);

/** Only active time counts; explicit pauses and time before the first key do not. */
export class TypingMeter {
  private startedAt: number | null = null;
  private pausedAt: number | null = null;
  private pausedMs = 0;
  private finishedAt: number | null = null;
  private attempts = 0;
  private mistakes = 0;
  private lastKeyAt: number | null = null;
  private cadence: CadenceMeasurement = { count: 0, sumMs: 0, sumSquaresMs: 0 };

  key(correct: boolean, now: number): void {
    if (this.pausedAt !== null || this.finishedAt !== null) return;
    const interval = this.lastKeyAt === null ? 0 : now - this.lastKeyAt;
    if (interval >= 25 && interval <= 1200) { this.cadence.count++; this.cadence.sumMs += interval; this.cadence.sumSquaresMs += interval * interval; }
    this.lastKeyAt = now;
    this.startedAt ??= now;
    this.attempts += 1;
    if (!correct) this.mistakes += 1;
  }

  pause(now: number): void { this.pausedAt ??= now; }
  resume(now: number): void {
    if (this.pausedAt !== null && this.startedAt !== null) this.pausedMs += now - this.pausedAt;
    this.pausedAt = null;
    this.lastKeyAt = null;
  }
  finish(now: number): void { this.finishedAt ??= now; }
  read(characters: number, now: number): TypingMeasurement {
    return {
      ...(this.cadence.count >= 2 ? { cadence: { ...this.cadence } } : {}),
      characters, attempts: this.attempts, mistakes: this.mistakes,
      durationMs: this.startedAt === null ? 0 : Math.max(1_000,
        (this.finishedAt ?? this.pausedAt ?? now) - this.startedAt - this.pausedMs)
    };
  }
}
