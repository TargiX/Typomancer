import type { CampaignGoal } from './campaignTraining.ts';
import type { DecisionPoint, GameModifiers, Language, MissionState, StoryGenreId, StoryLogItem, StorySegment } from '../types.ts';
import { normalizePact, type PactClauseId } from './pact.ts';
import { DEFAULT_MODIFIERS } from './perks.ts';
import { playerStorage } from './playerStorage.ts';

export const RUN_CHECKPOINT_STORAGE_KEY = 'typomancerRunCheckpoint';
const CHECKPOINT_VERSION = 1;
const GENRES: StoryGenreId[] = ['cyberpunk', 'space_horror', 'noir', 'dark_fable', 'dead_channel'];

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
  context?: RunContext;
  engine?: EngineCheckpoint;
}

export interface RunContext {
  campaignGoal?: CampaignGoal;
  id: string;
  language: Language;
  elapsedMs: number;
  storyLog: StoryLogItem[];
  levelStartIndex: number;
  characterDescription: string;
  pact: PactClauseId[];
  strictCase: boolean;
  relaxed: boolean;
  baselineWpm: number;
  stealthLevel: number;
  modifiers: GameModifiers;
}

/** Checkpoints restart the current line; they never store the player's input. */
export interface EngineCheckpoint {
  segment: StorySegment;
  history: StorySegment[];
  round: number;
  health: number;
  credits: number;
  combo: number;
  charge: number;
  trace: number;
  firewall: number;
  focusRemainingMs: number;
  decision?: DecisionPoint;
}

const isSegment = (value: unknown): value is StorySegment => {
  const segment = value as StorySegment | null;
  return !!segment && typeof segment.text === 'string' && segment.text.length > 0 && segment.text.length <= 4000
    && ['NARRATIVE', 'BREACH', 'DIALOG', 'SIGNAL'].includes(segment.type)
    && ['NEUTRAL', 'TENSE', 'HOPEFUL', 'DARK'].includes(segment.mood);
};

const normalizeEngine = (value: EngineCheckpoint | undefined): EngineCheckpoint | undefined => {
  if (!value || !isSegment(value.segment) || !Array.isArray(value.history) || value.history.length > 7
    || !value.history.every(isSegment) || !Number.isInteger(value.round) || value.round < 1 || value.round > 7
    || ![value.health, value.credits, value.combo, value.charge, value.trace, value.firewall, value.focusRemainingMs]
      .every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1e9)) return undefined;
  if (value.decision && (typeof value.decision.introText !== 'string'
    || !Array.isArray(value.decision.options) || value.decision.options.length !== 2
    || !value.decision.options.every(option => option && typeof option.text === 'string' && isSegment(option.outcome)))) return undefined;
  return { segment: value.segment, history: value.history, round: value.round, health: value.health,
    credits: value.credits, combo: value.combo, charge: value.charge, trace: value.trace,
    firewall: value.firewall, focusRemainingMs: value.focusRemainingMs, ...(value.decision ? { decision: value.decision } : {}) };
};

const normalizeContext = (value: RunContext | undefined): RunContext | undefined => {
  if (!value || typeof value.id !== 'string' || !value.id || value.id.length > 120 || !['en', 'ru'].includes(value.language)
    || !Array.isArray(value.storyLog) || value.storyLog.length > 64
    || !value.storyLog.every(item => item && typeof item.text === 'string' && item.text.length <= 8000
      && ['good', 'average', 'bad', 'neutral'].includes(item.performance)
      && [item.score, item.wpm, item.mistakes ?? 0, item.characters ?? 0, item.attempts ?? 0, item.durationMs ?? 0]
        .every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0))
    || !Number.isInteger(value.levelStartIndex) || value.levelStartIndex < 0 || value.levelStartIndex > value.storyLog.length
    || ![value.elapsedMs, value.baselineWpm, value.stealthLevel].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)
    || !value.modifiers || !Object.keys(DEFAULT_MODIFIERS).every(key => {
      const n = value.modifiers[key as keyof GameModifiers];
      return typeof n === 'number' && Number.isFinite(n) && n >= 0;
    })
    || typeof value.characterDescription !== 'string') return undefined;
  return { ...(value.campaignGoal === 'repair' || value.campaignGoal === 'codes' ? { campaignGoal: value.campaignGoal } : {}), id: value.id, language: value.language, elapsedMs: value.elapsedMs, storyLog: value.storyLog,
    levelStartIndex: value.levelStartIndex, characterDescription: value.characterDescription,
    pact: normalizePact(value.pact), strictCase: value.strictCase === true, relaxed: value.relaxed === true,
    baselineWpm: value.baselineWpm, stealthLevel: value.stealthLevel, modifiers: value.modifiers };
};

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
  const context = normalizeContext(checkpoint.context);
  const engine = normalizeEngine(checkpoint.engine);
  if (
    checkpoint.version !== CHECKPOINT_VERSION
    || !Number.isInteger(checkpoint.nextLevel)
    || (checkpoint.nextLevel as number) < (engine && context ? 1 : 2)
    || (checkpoint.nextLevel as number) > 4
    || !isFiniteNumber(checkpoint.health)
    || !isFiniteNumber(checkpoint.totalScore)
    || !GENRES.includes(checkpoint.genre as StoryGenreId)
    || typeof checkpoint.narrativeContext !== 'string'
    || !Array.isArray(checkpoint.perks)
    || !mission
    || (checkpoint.context !== undefined && !context)
    || (checkpoint.engine !== undefined && (!engine || !context))
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
    mission,
    ...(context ? { context } : {}),
    ...(engine ? { engine } : {})
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
