import type { UserProfile } from '../types.ts';
import { getStealthLevel } from './gameRules.ts';

/** A restored closing line must not deposit the same sector twice. */
export const settleRunReward = (profile: UserProfile, receipt: string, xp: number, credits: number): UserProfile => {
  if (profile.settledRewards?.includes(receipt)) return profile;
  const totalXp = profile.totalXp + Math.max(0, Math.floor(xp));
  return { ...profile, totalXp, stealthLevel: getStealthLevel(totalXp),
    credits: profile.credits + Math.max(0, Math.floor(credits)),
    settledRewards: [receipt, ...(profile.settledRewards || [])].slice(0, 200) };
};
