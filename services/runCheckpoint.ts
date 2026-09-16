import type { MissionState, StoryGenreId } from '../types.ts';
import { playerStorage } from './playerStorage.ts';

export const RUN_CHECKPOINT_STORAGE_KEY = 'typomancerRunCheckpoint';
const CHECKPOINT_VERSION = 1;
const GENRES: StoryGenreId[] = ['cyberpunk', 'space_horror', 'noir', 'dark_fable'];

export interface SavedPerk {
  groupId: string;
  tier: number;
}

export interface RunCheckpoint {
  version: 1;
  nextLevel: number;
  health: number;
  genre: StoryGenreId;
  narrativeContext: string;
  totalScore: number;
  perks: SavedPerk[];
  mission: MissionState;
}

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const normalizeMission = (value: unknown): MissionState | null => {
  if (!value || typeof value !== 'object') return null;
  const mission = value as Partial<MissionState>;
  if (
    !isFiniteNumber(mission.heat)
    || !isFiniteNumber(mission.trust)
    || !isFiniteNumber(mission.evidence)
    || !['balanced', 'silent', 'loud'].includes(mission.route || '')
  ) return null;

  return {
    heat: mission.heat,
    trust: mission.trust,
    evidence: mission.evidence,
    route: mission.route as MissionState['route'],
    flags: Array.isArray(mission.flags) ? mission.flags.filter((flag): flag is string => typeof flag === 'string') : [],
    consequenceLog: Array.isArray(mission.consequenceLog)
      ? mission.consequenceLog.filter((entry): entry is string => typeof entry === 'string')
      : [],
    lastDecision: typeof mission.lastDecision === 'string' ? mission.lastDecision : undefined
  };
};

export const normalizeRunCheckpoint = (value: unknown): RunCheckpoint | null => {
  if (!value || typeof value !== 'object') return null;
  const checkpoint = value as Partial<RunCheckpoint>;
  const mission = normalizeMission(checkpoint.mission);
  if (
    checkpoint.version !== CHECKPOINT_VERSION
    || !Number.isInteger(checkpoint.nextLevel)
    || (checkpoint.nextLevel as number) < 2
    || (checkpoint.nextLevel as number) > 4
    || !isFiniteNumber(checkpoint.health)
    || !isFiniteNumber(checkpoint.totalScore)
    || !GENRES.includes(checkpoint.genre as StoryGenreId)
    || typeof checkpoint.narrativeContext !== 'string'
    || !Array.isArray(checkpoint.perks)
    || !mission
  ) return null;

  const perks = checkpoint.perks
    .filter((perk): perk is SavedPerk => (
      Boolean(perk)
      && typeof perk.groupId === 'string'
      && Number.isInteger(perk.tier)
      && perk.tier >= 1
      && perk.tier <= 3
    ))
    .map((perk) => ({ groupId: perk.groupId, tier: perk.tier }));

  return {
    version: CHECKPOINT_VERSION,
    nextLevel: checkpoint.nextLevel as number,
    health: checkpoint.health,
    genre: checkpoint.genre as StoryGenreId,
    narrativeContext: checkpoint.narrativeContext,
    totalScore: checkpoint.totalScore,
    perks,
    mission
  };
};

export const loadRunCheckpoint = (storage?: Storage): RunCheckpoint | null => {
  const target = storage || playerStorage();
  if (!target) return null;
  try {
    const raw = target.getItem(RUN_CHECKPOINT_STORAGE_KEY);
    return raw ? normalizeRunCheckpoint(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const saveRunCheckpoint = (checkpoint: Omit<RunCheckpoint, 'version'>, storage?: Storage): RunCheckpoint => {
  const normalized: RunCheckpoint = { ...checkpoint, version: CHECKPOINT_VERSION };
  const target = storage || playerStorage();
  try {
    target?.setItem(RUN_CHECKPOINT_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Private/restricted storage must not prevent the sector from completing.
  }
  return normalized;
};

export const clearRunCheckpoint = (storage?: Storage): void => {
  const target = storage || playerStorage();
  try {
    target?.removeItem(RUN_CHECKPOINT_STORAGE_KEY);
  } catch {
    // The active run can still continue when persistence is unavailable.
  }
};
