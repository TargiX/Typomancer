import type { CampaignGoal } from './campaignTraining.ts';
export const PLAY_PREFERENCES_KEY = 'typomancerPlayPreferences';
export const SKILL_KEYS = ['Tab', 'F2', 'F3', 'F4', 'F6', 'F7', 'F8', 'ArrowUp', 'ArrowDown'] as const;
export type SkillKey = typeof SKILL_KEYS[number];
export interface PlayPreferences {
  campaignGoal: CampaignGoal;
  clearText: boolean;
  textSize: 20 | 24 | 28;
  reducedMotion: boolean;
  /** Story choices run on a 12-second fuse; off makes them untimed. Daily is always untimed. */
  timedDecisions: boolean;
  keys: { focus: SkillKey; firewall: SkillKey; purge: SkillKey };
}
export const DEFAULT_PLAY_PREFERENCES: PlayPreferences = {
  campaignGoal: 'flow', clearText: false, textSize: 24, reducedMotion: false, timedDecisions: true,
  keys: { focus: 'Tab', firewall: 'ArrowUp', purge: 'ArrowDown' }
};
export function normalizePlayPreferences(value: unknown): PlayPreferences {
  const p = (value && typeof value === 'object' ? value : {}) as Partial<PlayPreferences>;
  const keys = p.keys && Object.values(p.keys);
  const valid = keys?.length === 3 && new Set(keys).size === 3 && keys.every(key => SKILL_KEYS.includes(key));
  return { campaignGoal: p.campaignGoal === 'repair' || p.campaignGoal === 'codes' ? p.campaignGoal : 'flow', clearText: p.clearText === true, textSize: p.textSize === 20 || p.textSize === 28 ? p.textSize : 24,
    reducedMotion: p.reducedMotion === true, timedDecisions: p.timedDecisions !== false, keys: valid ? { ...p.keys! } : { ...DEFAULT_PLAY_PREFERENCES.keys } };
}
export function readPlayPreferences(): PlayPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(PLAY_PREFERENCES_KEY) || 'null');
    return normalizePlayPreferences({ ...value, reducedMotion: value?.reducedMotion ?? (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) });
  }
  catch { return normalizePlayPreferences(null); }
}
export function writePlayPreferences(value: PlayPreferences): PlayPreferences {
  const normalized = normalizePlayPreferences(value);
  try { localStorage.setItem(PLAY_PREFERENCES_KEY, JSON.stringify(normalized)); } catch { /* Device preference remains usable in memory. */ }
  return normalized;
}
export const keyLabel = (key: SkillKey): string => key === 'ArrowUp' ? '↑' : key === 'ArrowDown' ? '↓' : key === 'Tab' ? 'TAB' : key;
