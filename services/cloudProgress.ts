import { DEFAULT_PROFILE, PROFILE_STORAGE_KEY } from './profile.ts';
import { normalizePlayerProgress, PLAYER_PROGRESS_STORAGE_KEY } from './playerProgress.ts';
import { normalizeTypingTraining, TYPING_TRAINING_STORAGE_KEY } from './typingTraining.ts';
import { snapshotSchema, type ProgressSnapshot } from './progressSchema.ts';

export const META_KEY = 'cloud-save-meta-v1';
export interface SaveMeta { revision: number; synced: string; pending?: { mutationId: string; snapshot: ProgressSnapshot } }
export interface CloudSave { userId: string; revision: number; snapshot: ProgressSnapshot | null; updatedAt: string | null }
export function readSnapshot(storage: Storage): ProgressSnapshot {
  const read = (key: string) => { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : null; };
  const daily: ProgressSnapshot['daily'] = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith('nfDaily:')) daily[key] = read(key);
  }
  const profile = read(PROFILE_STORAGE_KEY) || {};
  return snapshotSchema.parse({ version: 1,
    profile: { ...DEFAULT_PROFILE, ...profile, upgrades: { ...DEFAULT_PROFILE.upgrades, ...profile.upgrades } },
    progress: normalizePlayerProgress(read(PLAYER_PROGRESS_STORAGE_KEY)),
    training: normalizeTypingTraining(read(TYPING_TRAINING_STORAGE_KEY)), daily });
}
export function writeSnapshot(storage: Storage, snapshot: ProgressSnapshot) {
  const safe = snapshotSchema.parse(snapshot);
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(safe.profile));
  storage.setItem(PLAYER_PROGRESS_STORAGE_KEY, JSON.stringify(safe.progress));
  storage.setItem(TYPING_TRAINING_STORAGE_KEY, JSON.stringify(safe.training));
  const oldDaily = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(key => key?.startsWith('nfDaily:'));
  for (const key of oldDaily) storage.removeItem(key!);
  for (const [key, value] of Object.entries(safe.daily)) storage.setItem(key, JSON.stringify(value));
}
export const fingerprint = (snapshot: ProgressSnapshot) => JSON.stringify(snapshot);
export const readMeta = (storage: Storage): SaveMeta | null => {
  const raw = storage.getItem(META_KEY);
  if (!raw) return null;
  const meta = JSON.parse(raw);
  if (!Number.isSafeInteger(meta.revision) || meta.revision < 0 || typeof meta.synced !== 'string') return null;
  return meta;
};
export const writeMeta = (storage: Storage, meta: SaveMeta) => storage.setItem(META_KEY, JSON.stringify(meta));
export function isDirty(snapshot: ProgressSnapshot, meta: SaveMeta | null) {
  return Boolean(meta && (meta.pending || fingerprint(snapshot) !== meta.synced));
}
export class ApiError extends Error {
  constructor(public status: number, public code?: string) { super(`Request failed (${status})`); }
}
export async function api<T>(path: string, body?: unknown, method = 'POST', headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store',
    method: body === undefined ? 'GET' : method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000) });
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, data.code);
  return data;
}
export function downloadSnapshot(value: unknown, name = 'typomancer-device-backup.json') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
