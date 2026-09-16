import type { GameModifiers, Language, Perk, UserUpgrades } from '../types.ts';
import type { GenreSkin, PerkGroupId, UpgradeId } from './genreSkin.ts';

// --- TIERED PERK DEFINITIONS (mechanics only; display names come from genre skins) ---
export interface PerkDefinition {
    groupId: PerkGroupId;
    type: Perk['type'];
    tiers: ReadonlyArray<Record<string, number>>;
}

export const PERK_DEFINITIONS: PerkDefinition[] = [
    {
        // Was: forgive N mistakes outright. Now a mistake keeps your streak alive
        // but bills you the Energy you would have spent on a protocol — a trade,
        // not a free pass.
        groupId: 'neural_buffer',
        type: 'defense',
        tiers: [
            { shields: 1, cost: 30 },
            { shields: 2, cost: 25 },
            { shields: 3, cost: 20 }
        ]
    },
    {
        // Was: a flat trace slowdown you kept whatever you did. Now the stealth
        // has to be held with a clean streak.
        groupId: 'ghost_protocol',
        type: 'stealth',
        tiers: [
            { streakMult: 0.85, threshold: 25 },
            { streakMult: 0.75, threshold: 20 },
            { streakMult: 0.65, threshold: 15 }
        ]
    },
    {
        groupId: 'adrenaline_spike',
        type: 'offense',
        tiers: [
            { thresh: 80, regen: 2 },
            { thresh: 70, regen: 3 },
            { thresh: 60, regen: 4 }
        ]
    },
    {
        // Was: a bigger health pool, which is just room to fail more. Now health
        // comes back for lines typed perfectly.
        groupId: 'titanium_firewall',
        type: 'defense',
        tiers: [
            { perfectHeal: 2 },
            { perfectHeal: 3 },
            { perfectHeal: 5 }
        ]
    },
    {
        // Was: a chance the line typed itself. In a typing game that is not a
        // perk, it is an opt-out. Now a long clean streak shoves the tracer back.
        groupId: 'critical_override',
        type: 'utility',
        tiers: [
            { interval: 50, characters: 14 },
            { interval: 35, characters: 18 },
            { interval: 25, characters: 22 }
        ]
    },
    {
        groupId: 'focus_lattice',
        type: 'utility',
        tiers: [
            { duration: 1000, forgiveness: 1 },
            { duration: 2000, forgiveness: 2 },
            { duration: 3000, forgiveness: 3 }
        ]
    },
    {
        groupId: 'error_siphon',
        type: 'offense',
        tiers: [
            { charge: 2 },
            { charge: 4 },
            { charge: 7 }
        ]
    },
    {
        groupId: 'evidence_lens',
        type: 'stealth',
        tiers: [
            { evidence: 0.15 },
            { evidence: 0.30 },
            { evidence: 0.50 }
        ]
    }
];

export const DEFAULT_MODIFIERS: GameModifiers = {
    traceSpeedMultiplier: 1.0,
    mistakeGraceCount: 0,
    healthRegenWpmThreshold: 0,
    healthRegenAmount: 0,
    maxHealth: 20,
    maxOverclock: 50,
    creditMultiplier: 1.0,
    focusDurationMs: 6500,
    focusMistakeForgiveness: 2,
    errorChargeGain: 0,
    breachRewardMultiplier: 1,
    evidenceMultiplier: 1,
    streakPurgeInterval: 0,
    streakPurgeCharacters: 0,
    streakTraceMultiplier: 1,
    streakTraceThreshold: 0,
    perfectLineHealth: 0,
    comboShields: 0,
    comboShieldCost: 0
};

export const META_UPGRADES: Record<UpgradeId, { baseCost: number; effectPerLevel: number; maxLevel: number }> = {
    synapticWeave: { baseCost: 100, effectPerLevel: 2, maxLevel: 10 },
    cryptoMiner: { baseCost: 150, effectPerLevel: 0.1, maxLevel: 10 },
    signalDampener: { baseCost: 200, effectPerLevel: 0.05, maxLevel: 10 },
    bufferExpansion: { baseCost: 120, effectPerLevel: 5, maxLevel: 10 },
    focusLens: { baseCost: 180, effectPerLevel: 500, maxLevel: 8 },
    patternScanner: { baseCost: 220, effectPerLevel: 0.08, maxLevel: 8 }
};

/**
 * Perk firmware lives on the operator deck — the skin and language come from the
 * caller so names stay cyberpunk even inside another simulation.
 */
export const createPerk = (def: PerkDefinition, tierIndex: number, skin: GenreSkin, language: Language): Perk => {
    const tierData = def.tiers[tierIndex];
    const perkSkin = skin.perks[def.groupId];
    return {
        id: `${def.groupId}_${tierIndex + 1}`,
        groupId: def.groupId,
        name: `${perkSkin.name[language]} ${['I','II','III'][tierIndex]}`,
        description: perkSkin.tiers[tierIndex][language],
        type: def.type,
        rarity: tierIndex === 0 ? 'common' : tierIndex === 1 ? 'rare' : 'legendary',
        tier: tierIndex + 1,
        maxTier: def.tiers.length,
        apply: (mods) => {
            const newMods = { ...mods };
            if (def.groupId === 'neural_buffer') {
                newMods.comboShields = Math.max(newMods.comboShields, tierData.shields);
                newMods.comboShieldCost = tierData.cost;
            }
            if (def.groupId === 'ghost_protocol') {
                newMods.streakTraceMultiplier = Math.min(newMods.streakTraceMultiplier, tierData.streakMult);
                newMods.streakTraceThreshold = tierData.threshold;
            }
            if (def.groupId === 'adrenaline_spike') {
                newMods.healthRegenWpmThreshold = tierData.thresh;
                newMods.healthRegenAmount = tierData.regen;
            }
            if (def.groupId === 'titanium_firewall') newMods.perfectLineHealth = Math.max(newMods.perfectLineHealth, tierData.perfectHeal);
            if (def.groupId === 'critical_override') {
                newMods.streakPurgeInterval = tierData.interval;
                newMods.streakPurgeCharacters = tierData.characters;
            }
            if (def.groupId === 'focus_lattice') { newMods.focusDurationMs += tierData.duration; newMods.focusMistakeForgiveness += tierData.forgiveness; }
            if (def.groupId === 'error_siphon') newMods.errorChargeGain = Math.max(newMods.errorChargeGain, tierData.charge);
            if (def.groupId === 'evidence_lens') newMods.evidenceMultiplier += tierData.evidence;
            return newMods;
        }
    };
};

export const getRarityRoll = (performance: 'bad' | 'average' | 'good' | 'legendary'): number => {
    const rand = Math.random();
    if (performance === 'legendary') {
        if (rand < 0.20) return 2;
        if (rand < 0.60) return 1;
        return 0;
    }
    if (performance === 'good') {
        if (rand < 0.05) return 2;
        if (rand < 0.30) return 1;
        return 0;
    }
    if (performance === 'average') {
        if (rand < 0.01) return 2;
        if (rand < 0.10) return 1;
        return 0;
    }
    return 0;
};

/**
 * Three choices: up to two tier-ups for perks already installed, then new groups
 * rolled on the performance table. Offered perks keep their deck skin/language.
 */
export const getUpgradeOptions = (
    performance: 'bad' | 'average' | 'good' | 'legendary',
    activePerks: Perk[],
    skin: GenreSkin,
    language: Language
): Perk[] => {
    const options: Perk[] = [];
    const usedGroupIds = new Set<string>();
    const upgradeCandidates: Perk[] = [];
    activePerks.forEach(p => {
        const def = PERK_DEFINITIONS.find(d => d.groupId === p.groupId);
        if (def && p.tier < p.maxTier) {
            upgradeCandidates.push(createPerk(def, p.tier, skin, language));
            usedGroupIds.add(p.groupId);
        } else {
            usedGroupIds.add(p.groupId);
        }
    });

    const pickedUpgrades = upgradeCandidates.sort(() => 0.5 - Math.random()).slice(0, 2);
    options.push(...pickedUpgrades);

    const availableNewDefinitions = PERK_DEFINITIONS.filter(d => !usedGroupIds.has(d.groupId));
    const shuffledDefinitions = [...availableNewDefinitions].sort(() => 0.5 - Math.random());
    const slotsNeeded = 3 - options.length;

    for (let i = 0; i < slotsNeeded; i++) {
        if (shuffledDefinitions[i]) {
            const def = shuffledDefinitions[i];
            const rolledTierIndex = getRarityRoll(performance);
            const finalTierIndex = Math.min(rolledTierIndex, def.tiers.length - 1);
            options.push(createPerk(def, finalTierIndex, skin, language));
        }
    }
    return options.sort(() => 0.5 - Math.random());
};

export const getUpgradeCost = (key: UpgradeId, currentLevel: number): number => {
    const upgrade = META_UPGRADES[key];
    return Math.floor(upgrade.baseCost * (1 + (currentLevel * 0.5)));
};

export const UPGRADE_KEYS = Object.keys(META_UPGRADES) as (keyof UserUpgrades)[];
