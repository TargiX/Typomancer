import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerStorage, clearAccountDeviceData } from '../services/playerStorage.ts';
import { readSnapshot, writeSnapshot, fingerprint, isDirty, readMeta, writeMeta } from '../services/cloudProgress.ts';
import { snapshotSchema, saveRequestSchema } from '../services/progressSchema.ts';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return { get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: k => { data.delete(k); }, clear: () => data.clear() };
}
test('deletion cleanup preserves guest data and a different last-account identity', () => {
  const raw = memoryStorage();
  raw.setItem('guest', 'keep');
  playerStorage('A', raw)!.setItem('save', 'delete');
  playerStorage('B', raw)!.setItem('save', 'keep');
  raw.setItem('typomancer:last-account', JSON.stringify({ id: 'B' }));
  raw.setItem('typomancer:recovery:A', 'delete');
  clearAccountDeviceData('A', raw);
  assert.equal(playerStorage('A', raw)!.length, 0);
  assert.equal(raw.getItem('typomancer:recovery:A'), null);
  assert.equal(raw.getItem('guest'), 'keep');
  assert.equal(playerStorage('B', raw)!.getItem('save'), 'keep');
  assert.equal(JSON.parse(raw.getItem('typomancer:last-account')!).id, 'B');
  assert.throws(() => clearAccountDeviceData('', raw));
});
test('guest, A and B storage stay isolated including checkpoint and daily cleanup', () => {
  const raw = memoryStorage();
  const a = playerStorage('a', raw)!; const b = playerStorage('b', raw)!;
  raw.setItem('narrativeFlowProfile', 'guest');
  a.setItem('narrativeFlowProfile', 'A'); b.setItem('narrativeFlowProfile', 'B');
  a.setItem('nfDaily:today', 'A'); b.setItem('nfDaily:today', 'B');
  a.removeItem('nfDaily:today');
  assert.equal(b.getItem('nfDaily:today'), 'B');
  assert.equal(raw.getItem('narrativeFlowProfile'), 'guest');
  assert.equal(a.getItem('narrativeFlowProfile'), 'A');
  assert.equal(a.length, 1); assert.equal(a.key(0), 'narrativeFlowProfile');
  a.clear(); assert.equal(b.getItem('narrativeFlowProfile'), 'B');
});
test('snapshot roundtrip includes stats and upgrades but excludes typed text and run narrative', () => {
  const storage = memoryStorage();
  const snapshot = readSnapshot(storage);
  snapshot.profile.credits = 123;
  snapshot.daily['nfDaily:20260916'] = { attemptsUsed: 1, bestScore: 500, bestEnding: 'ok' };
  writeSnapshot(storage, snapshot);
  storage.setItem('typomancerRunCheckpoint', '{"narrativeContext":"private story"}');
  storage.setItem('arbitraryKey', 'secret');
  const read = readSnapshot(storage);
  assert.deepEqual(read, snapshot);
  assert.ok(!fingerprint(read).includes('private story'));
  assert.ok(!fingerprint(read).includes('secret'));
});
test('schema strips unknown fields and rejects malformed or oversized game data', () => {
  const initial = readSnapshot(memoryStorage());
  assert.equal('rawText' in snapshotSchema.parse({ ...initial, rawText: 'private' }), false);
  assert.equal(snapshotSchema.safeParse({ ...initial, version: 2 }).success, false);
  assert.equal(snapshotSchema.safeParse({ ...initial, profile: { ...initial.profile, credits: Infinity } }).success, false);
  assert.equal(snapshotSchema.safeParse({ ...initial, training: { ...initial.training, keys: Array(65).fill({ token: 'a', attempts: 1, errors: 0, totalLatencyMs: 50 }) } }).success, false);
  assert.equal(saveRequestSchema.safeParse({ userId: 'a', revision: -1, mutationId: crypto.randomUUID(), snapshot: initial }).success, false);
});
test('pending save survives reload and remains dirty even when its current snapshot matches', () => {
  const storage = memoryStorage(); const snapshot = readSnapshot(storage);
  const meta = { revision: 3, synced: fingerprint(snapshot), pending: { mutationId: crypto.randomUUID(), snapshot } };
  writeMeta(storage, meta);
  assert.deepEqual(readMeta(storage), meta);
  assert.equal(isDirty(snapshot, readMeta(storage)), true);
  writeMeta(storage, { revision: 4, synced: fingerprint(snapshot) });
  assert.equal(isDirty(snapshot, readMeta(storage)), false);
  snapshot.profile.credits++;
  assert.equal(isDirty(snapshot, readMeta(storage)), true);
});
