import type { PactClauseId } from './services/pact.ts';

export type Language = 'en' | 'ru';

export enum GameState {
  MENU = 'MENU',
  CALIBRATION = 'CALIBRATION',
  OPERATOR_RECORD = 'OPERATOR_RECORD',
  GENRE_SELECTION = 'GENRE_SELECTION',
  PLAYING = 'PLAYING',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
  LOADING = 'LOADING',
  UPGRADES = 'UPGRADES',
  STARTER_PERK_SELECTION = 'STARTER_PERK_SELECTION',
  BLACK_MARKET = 'BLACK_MARKET'
}

export type StoryGenreId = 'cyberpunk' | 'space_horror' | 'noir' | 'dark_fable';

export enum StoryMood {
  NEUTRAL = 'NEUTRAL',
  TENSE = 'TENSE',
  HOPEFUL = 'HOPEFUL',
  DARK = 'DARK'
}

export enum SegmentType {
  NARRATIVE = 'NARRATIVE',
  BREACH = 'BREACH',
  DIALOG = 'DIALOG',
  SIGNAL = 'SIGNAL'
}

export type TypingSkill = 'flow' | 'precision' | 'symbols' | 'numbers' | 'punctuation';
export type RouteStyle = 'balanced' | 'silent' | 'loud';

/**
 * Three meters, each with a distinct source and a distinct consequence: Heat is
 * how hunted you are, Trust is who is still with you, Evidence is how much proof
 * you have and the win condition.
 *
 * There used to be five. `signal` was never shown to the player and never read
 * by any rule — it existed only as a number in a prompt. `corruption` moved in
 * lockstep with Heat (both rose on a fumbled line, both fed trace pressure), so
 * it asked the player to track two readings of one thing.
 */
export interface MissionState {
  heat: number;
  trust: number;
  evidence: number;
  route: RouteStyle;
  flags: string[];
  consequenceLog: string[];
  lastDecision?: string;
}

export interface StorySegment {
  text: string;
  mood: StoryMood;
  type: SegmentType;
  performance?: 'good' | 'average' | 'bad';
  skill?: TypingSkill;
  objective?: string;
  pressure?: number;
  consequenceHint?: string;
}

export interface BranchingStory {
  goodPath: StorySegment;
  mediumPath: StorySegment;
  badPath: StorySegment;
}

export interface DecisionImpact {
  heat?: number;
  trust?: number;
  evidence?: number;
  route?: RouteStyle;
  flag?: string;
  trace?: number;
  health?: number;
  credits?: number;
}

export interface DecisionOption {
  id: string;
  text: string;
  type: 'aggressive' | 'stealth';
  outcome: StorySegment;
  preview?: string;
  impact?: DecisionImpact;
}

export interface DecisionPoint {
  introText: string;
  options: [DecisionOption, DecisionOption];
}

export interface StoryLogItem {
  text: string;
  performance: 'good' | 'average' | 'bad' | 'neutral';
  score: number;
  wpm: number;
  mistakes?: number;
  characters?: number;
  type?: SegmentType;
  meta?: string;
}

export interface ComicFrame {
  image: string | null;
  caption: string;
  performance: 'good' | 'average' | 'bad' | 'neutral';
  level: number;
}

export interface GameStats {
  wpm: number;
  accuracy: number;
  health: number;
  level: number;
  round: number;
  score: number;
  credits: number;
  mistakes?: number;
  characters?: number;
  consistency?: number;
  bestWpm?: number;
  segments?: number;
  mission?: MissionState;
}

export interface GameModifiers {
  traceSpeedMultiplier: number;
  mistakeGraceCount: number;
  healthRegenWpmThreshold: number;
  healthRegenAmount: number;
  maxHealth: number;
  maxOverclock: number;
  creditMultiplier: number;
  focusDurationMs: number;
  focusMistakeForgiveness: number;
  errorChargeGain: number;
  breachRewardMultiplier: number;
  evidenceMultiplier: number;
  /**
   * Perk effects that pay out for accuracy instead of excusing its absence.
   * A perk that lowers what the fingers are asked to do works against the only
   * progression that matters in a typing game — the player's own hands.
   */
  /** Unbroken correct keystrokes that throw the tracer back. 0 disables. */
  streakPurgeInterval: number;
  /** Characters the tracer loses when that streak lands. */
  streakPurgeCharacters: number;
  /** Security Trace multiplier while a streak is held. 1 disables. */
  streakTraceMultiplier: number;
  /** Combo needed to hold that stealth. */
  streakTraceThreshold: number;
  /** Health restored by a line typed with zero mistakes. */
  perfectLineHealth: number;
  /** Mistakes per round that keep the combo alive, paid for in Energy. */
  comboShields: number;
  /** Energy each combo shield costs. */
  comboShieldCost: number;
}

export interface Perk {
  id: string;
  groupId: string;
  tier: number;
  maxTier: number;
  name: string;
  description: string;
  type: 'stealth' | 'defense' | 'offense' | 'utility';
  rarity: 'common' | 'rare' | 'legendary';
  apply: (mods: GameModifiers) => GameModifiers;
}

export interface LevelReport {
  level: number;
  avgWpm: number;
  totalMistakes: number;
  accuracy?: number;
  consistency?: number;
  finalHealth: number;
  traceLevel: number;
  narrativeSummary: string;
  creditsEarned: number;
  mission?: MissionState;
  route?: RouteStyle;
  endingTitle?: string;
}

export interface UserUpgrades {
  synapticWeave: number;
  cryptoMiner: number;
  signalDampener: number;
  bufferExpansion: number;
  focusLens: number;
  patternScanner: number;
}

export interface UserProfile {
  totalXp: number;
  stealthLevel: number;
  unlockedPerks: string[];
  credits: number;
  upgrades: UserUpgrades;
  language?: Language;
  strictCase?: boolean;
  /** Difficulty the player asked for, in exchange for a bigger payout. */
  pact?: PactClauseId[];
}
