import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLAY_PREFERENCES, normalizePlayPreferences } from '../services/playPreferences.ts';
import { freezeSessionRules, DAILY_RULESET } from '../services/sessionRules.ts';
import { DEFAULT_MODIFIERS } from '../services/perks.ts';
import { reserveDailyAttempt, getDailyState, recordDailyAttempt, getDailyBrief } from '../services/dailyMode.ts';
import { parseChallenge, getChallengeVerdict, buildChallengeShareUrl } from '../services/challenge.ts';
import challengeHandler from '../api/challenge.ts';
import { EMPTY_TYPING_TRAINING, recordTypingSession, recentPattern, getTrainingFocusTokens, recordPatternReview, getDuePatterns, getBenchmarkDelta } from '../services/typingTraining.ts';
import { EMPTY_PLAYER_PROGRESS, recordRun, type RunRecord } from '../services/playerProgress.ts';
import { getSkillHeadline, getPatternDiagnostics } from '../services/progressAnalytics.ts';
import { TypingMeter } from '../services/typingMetrics.ts';
import { summarizeSector, DEFAULT_BRANCH_THRESHOLDS } from '../services/gameRules.ts';
import { getWeeklyProgress } from '../services/weeklyProgress.ts';
import { prepareCampaignSegment, canTransmit } from '../services/campaignTraining.ts';
import { practicePrompt } from '../services/practiceSession.ts';
import { getSegmentResult } from '../services/segmentResult.ts';
import { StoryMood, SegmentType } from '../types.ts';
import { readSnapshot, writeSnapshot } from '../services/cloudProgress.ts';

const at = '2026-09-26T12:00:00.000Z';
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return { get length() { return data.size; }, key: i => [...data.keys()][i] ?? null, getItem: k => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); }, removeItem: k => { data.delete(k); }, clear: () => data.clear() };
}
const observation = (correct = true) => ({ expected: 'h', previousExpected: 't', correct, latencyMs: 150 });
test('Daily ignores profile gear, XP, pact, comfort and campaign goal', () => {
  const personalized = { language: 'en' as const, campaignGoal: 'repair' as const, pact: ['hunted' as const], strictCase: true, relaxed: true, baselineWpm: 180, stealthLevel: 20,
    modifiers: { ...DEFAULT_MODIFIERS, maxHealth: 80, creditMultiplier: 5, traceSpeedMultiplier: 0.1 } };
  const fixed = freezeSessionRules(personalized, true);
  assert.deepEqual(fixed, freezeSessionRules({ ...personalized, pact: [], baselineWpm: 20, modifiers: DEFAULT_MODIFIERS }, true));
  assert.equal(fixed.modifiers.maxHealth, DEFAULT_MODIFIERS.maxHealth);
  assert.equal(fixed.campaignGoal, 'flow');
  assert.deepEqual(fixed.pact, []);
  const campaign = freezeSessionRules(personalized, false);
  campaign.modifiers.maxHealth = 1;
  assert.equal(personalized.modifiers.maxHealth, 80);
});
test('Daily reserves abandoned attempts and separates languages without deleting another result', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true });
  try {
    const id = 'SECTOR-20260926';
    assert.equal(reserveDailyAttempt(id, 'en')?.attemptsUsed, 1);
    assert.equal(recordDailyAttempt(id, 300, 'done', 'en', true).attemptsUsed, 1);
    assert.equal(getDailyState(id, 'ru').attemptsUsed, 0);
    reserveDailyAttempt(id, 'en'); reserveDailyAttempt(id, 'en');
    assert.equal(reserveDailyAttempt(id, 'en'), null);
    reserveDailyAttempt(id, 'ru');
    assert.equal(getDailyState(id, 'en').bestScore, 300);
    assert.equal(getDailyState(id, 'ru').attemptsUsed, 1);
  } finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});
test('Daily uses one UTC date across time zones', () => {
  assert.equal(getDailyBrief(new Date('2026-09-27T01:00:00+07:00')).dailyId, 'SECTOR-20260926');
  assert.equal(getDailyBrief(new Date('2026-09-26T11:00:00-07:00')).dailyId, 'SECTOR-20260926');
});
test('shared challenge carries language and rules through wrapper; legacy and other languages cannot compete', () => {
  const url = buildChallengeShareUrl('https://example.com', 'SECTOR-20260926', 100, 'ru')!;
  let body = '';
  challengeHandler({ url, headers: { host: 'example.com' } }, { setHeader() {}, end(s: string) { body = s; } });
  assert.match(body, /rules=daily-v2&amp;lang=ru/);
  const challenge = parseChallenge('?challenge=SECTOR-20260926&target=100&lang=ru&rules=daily-v2');
  assert.equal(challenge?.ruleset, DAILY_RULESET);
  assert.deepEqual(getChallengeVerdict(challenge, 'SECTOR-20260926', 110, 'ru'), { outcome: 'beaten', delta: 10 });
  assert.equal(getChallengeVerdict(challenge, 'SECTOR-20260926', 110, 'en'), null);
  assert.equal(getChallengeVerdict({ dailyId: 'SECTOR-20260926', targetScore: 100 }, 'SECTOR-20260926', 110, 'ru'), null);
});
test('rare supported mistakes survive a profile full of frequent clean pairs', () => {
  const bigrams = Array.from({ length: 64 }, (_, i) => ({ token: `${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + i % 26)}`, attempts: 1000, errors: 0, totalLatencyMs: 100000, timedAttempts: 1000 }));
  const p = recordTypingSession({ ...EMPTY_TYPING_TRAINING, bigrams }, Array.from({ length: 8 }, () => ({ expected: 'z', previousExpected: 'z', correct: false, latencyMs: 200 })), undefined, at);
  assert.equal(p.bigrams.length, 64);
  assert.equal(p.bigrams.find(s => s.token === 'zz')?.errors, 8);
});
test('recent windows forget resolved errors while historical totals remain', () => {
  let p = recordTypingSession(EMPTY_TYPING_TRAINING, Array.from({ length: 8 }, () => observation(false)), undefined, at);
  for (let i = 0; i < 8; i++) p = recordTypingSession(p, Array.from({ length: 8 }, () => observation()), undefined, at);
  const stat = p.bigrams.find(s => s.token === 'th')!;
  assert.equal(stat.errors, 8);
  assert.equal(recentPattern(stat, Date.parse(at)).errors, 0);
  assert.equal(recentPattern(stat, Date.parse(at) + 15 * 86400000).attempts, 0);
});
test('language focus and diagnostics exclude the other alphabet and unknown latency is missing', () => {
  const p = { ...EMPTY_TYPING_TRAINING, keys: ['a', 'я'].map(token => ({ token, attempts: 8, errors: 4, totalLatencyMs: 0, timedAttempts: 0 })) };
  assert.deepEqual(getTrainingFocusTokens(p, 4, 6, 'en'), ['a']);
  assert.deepEqual(getPatternDiagnostics(p, 8, 4, 'ru').map(s => s.token), ['я']);
  assert.equal(getPatternDiagnostics(p)[0].avgLatencyMs, null);
});
test('spaced reviews require exposure, separate days and the due date; a relapse resets progress', () => {
  const clean = Array.from({ length: 8 }, () => observation());
  let p = recordPatternReview(EMPTY_TYPING_TRAINING, 'en', ['th'], clean.slice(0, 7), at);
  assert.equal(p.reviews?.length, 0);
  p = recordPatternReview(p, 'en', ['th'], clean, at);
  assert.equal(p.reviews?.[0].successfulDays, 1);
  p = recordPatternReview(p, 'en', ['th'], clean, at);
  assert.equal(p.reviews?.[0].successfulDays, 1);
  p = recordPatternReview(p, 'en', ['th'], clean, '2026-09-27T12:00:00.000Z');
  assert.equal(p.reviews?.[0].successfulDays, 2);
  p = recordPatternReview(p, 'en', ['th'], clean, '2026-09-28T12:00:00.000Z');
  assert.equal(p.reviews?.[0].successfulDays, 2);
  assert.equal(getDuePatterns(p, 'en', Date.parse('2026-09-30T12:00:00.000Z')).length, 1);
  p = recordPatternReview(p, 'en', ['th'], clean, '2026-09-30T12:00:00.000Z');
  assert.equal(p.reviews?.[0].successfulDays, 3);
  p = recordPatternReview(p, 'en', ['th'], [observation(false), ...clean], '2026-10-07T12:00:00.000Z');
  assert.equal(p.reviews?.[0].successfulDays, 0);
});
test('controlled benchmark baseline survives rolling history and respects prompt identity', () => {
  let p = EMPTY_TYPING_TRAINING;
  for (let i = 0; i < 20; i++) p = recordTypingSession(p, [], { kind: 'drill', language: 'en', promptId: 'fixed-v2', measurementVersion: 2, wpm: 30 + i, accuracy: 98, completedAt: new Date(Date.parse(at) + i * 86400000).toISOString() });
  assert.equal(p.benchmarks.length, 12);
  assert.equal(getBenchmarkDelta(p, 'en')?.wpm, 19);
  p = recordTypingSession(p, [], { kind: 'drill', language: 'en', promptId: 'other', measurementVersion: 2, wpm: 100, accuracy: 98, completedAt: at });
  assert.equal(getBenchmarkDelta(p, 'en'), null);
});
test('story baseline survives 60-run retention without comparing another goal', () => {
  let p = EMPTY_PLAYER_PROGRESS;
  for (let i = 0; i < 70; i++) {
    const endedAt = new Date(Date.parse(at) + i * 86400000).toISOString();
    const run: RunRecord = { id: String(i), endedAt, dateKey: endedAt.slice(0, 10), language: 'en', measurementVersion: 2,
      wpm: 30 + i, bestWpm: 30 + i, accuracy: 99, consistency: 90, mistakes: 1, characters: 100,
      daily: false, genre: 'cyberpunk', level: 1, score: 100, durationSeconds: 60, focus: 'accuracy', outcome: 'victory', pact: [] };
    p = recordRun(p, run);
  }
  assert.equal(p.runs.length, 60);
  assert.equal(getSkillHeadline(p, 'en').baselineWpm, 32);
  p = recordRun(p, { ...p.runs[0], id: 'repair', campaignGoal: 'repair', wpm: 10 });
  assert.equal(getSkillHeadline(p, 'en').hasEnoughHistory, false);
});
test('cadence combines key intervals, ignoring passage length and pauses', () => {
  const meter = new TypingMeter();
  for (let i = 0; i <= 6; i++) meter.key(true, 1000 + i * 200);
  meter.pause(2300); meter.resume(99000); meter.key(true, 99100);
  const measurement = meter.read(8, 99100);
  assert.equal(measurement.cadence?.count, 6);
  assert.equal(summarizeSector([{ ...measurement, wpm: 10, score: 0 }, { ...measurement, characters: 80, wpm: 100, score: 0 }]).consistency, 100);
});
test('practice days count without fabricating speed and weekly averages use matching runs', () => {
  const now = new Date(2026, 8, 26, 18);
  const run = { id: 'x', endedAt: new Date(2026, 8, 26, 12).toISOString(), wpm: 100, accuracy: 90 } as RunRecord;
  const days = getWeeklyProgress([run], now, ['2026-09-25'], []);
  assert.equal(days[5].practiced, true);
  assert.equal(days[5].wpm, null);
  assert.equal(days[6].count, 1);
  assert.equal(days[6].wpm, null);
});
const segment = { text: 'Keep moving.', mood: StoryMood.NEUTRAL, type: SegmentType.NARRATIVE };
test('repair requires corrected text; codes vary by run and offline focus is authored', () => {
  const match = (a: string, b: string) => a === b;
  assert.equal(canTransmit('abc', 'abx', 'flow', match), true);
  assert.equal(canTransmit('abc', 'abx', 'repair', match), false);
  assert.equal(canTransmit('abc', 'abc', 'repair', match), true);
  const code = prepareCampaignSegment(segment, 'en', 'codes', [], 1, 2, 'a');
  assert.match(code.text, /Code: \d{2}:\d{2} \/ \d{3}-\d{2}/);
  assert.notEqual(code.text, prepareCampaignSegment(segment, 'en', 'codes', [], 1, 2, 'b').text);
  assert.match(prepareCampaignSegment(segment, 'en', 'flow', ['th'], 1, 2, 'a').text, /th/i);
});
test('targeted practice progresses from patterns to words to context without changing the control passages', () => {
  assert.notEqual(practicePrompt('en', 1, 0, ['th'], 0), practicePrompt('en', 1, 0, ['th'], 1));
  assert.match(practicePrompt('ru', 1, 0, ['щщ'], 2), /Передай код: щщ/);
  assert.equal(practicePrompt('en', 0, 2, []), practicePrompt('en', 2, 2, ['th']));
});
test('settlement keeps raw mistakes distinct from game forgiveness and applies closing-line healing', () => {
  const result = getSegmentResult({ characters: 100, attempts: 102, mistakes: 2, durationMs: 30000 }, 0, segment, DEFAULT_MODIFIERS, DEFAULT_BRANCH_THRESHOLDS, false, 1);
  assert.equal(result.performance, 'good'); assert.equal(result.measurement.mistakes, 2);
  assert.equal(result.credits, 18); assert.ok(result.healing > 0); assert.ok(result.accuracy < 100);
});
test('invalid or duplicate skill bindings restore defaults; Tab cannot be trapped by a skill', () => {
  assert.deepEqual(normalizePlayPreferences({ keys: { focus: 'Tab', firewall: 'F2', purge: 'F2' } }).keys, DEFAULT_PLAY_PREFERENCES.keys);
  assert.equal(normalizePlayPreferences({ textSize: 900 }).textSize, 24);
});
test('aggregate training windows, baselines and review schedule survive cloud schema roundtrip', () => {
  const storage = memoryStorage();
  const observations = Array.from({ length: 8 }, () => observation());
  const training = recordPatternReview(recordTypingSession(EMPTY_TYPING_TRAINING, observations, { kind: 'drill', language: 'en', promptId: 'fixed', measurementVersion: 2, wpm: 40, accuracy: 100, completedAt: at }, at), 'en', ['th'], observations, at);
  storage.setItem('typomancerTypingTraining', JSON.stringify(training));
  const snapshot = readSnapshot(storage); writeSnapshot(storage, snapshot);
  assert.deepEqual(readSnapshot(storage), snapshot);
  assert.equal(snapshot.training.reviews?.[0].successfulDays, 1);
  assert.equal(snapshot.training.bigrams[0].recent?.[0].attempts, 8);
  assert.equal(snapshot.training.baselines?.length, 1);
});
