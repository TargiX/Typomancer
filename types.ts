export type Language = 'en' | 'ru';

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
  LOADING = 'LOADING',
  UPGRADES = 'UPGRADES',
  STARTER_PERK_SELECTION = 'STARTER_PERK_SELECTION',
  BLACK_MARKET = 'BLACK_MARKET'
}

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

export interface MissionState {
  heat: number;
  trust: number;
  evidence: number;
  corruption: number;
  signal: number;
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
  corruption?: number;
  signal?: number;
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
  mission?: MissionState;
}

export interface GameModifiers {
  traceSpeedMultiplier: number;
  mistakeGraceCount: number;
  healthRegenWpmThreshold: number;
  criticalHackChance: number;
  maxHealth: number;
  maxOverclock: number;
  creditMultiplier: number;
  focusDurationMs: number;
  focusMistakeForgiveness: number;
  errorChargeGain: number;
  breachRewardMultiplier: number;
  evidenceMultiplier: number;
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
}
