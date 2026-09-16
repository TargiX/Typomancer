import type { Language, MissionState, StoryGenreId, UserProfile } from '../types.ts';
import { GENRE_ORDER } from './genreConfig.ts';
import { getStealthLevel } from './gameRules.ts';
import { normalizePact, type PactClauseId } from './pact.ts';

export const PROFILE_STORAGE_KEY = 'narrativeFlowProfile';

export const DEFAULT_MISSION_STATE: MissionState = {
    heat: 18,
    trust: 44,
    evidence: 0,
    route: 'balanced',
    flags: [],
    consequenceLog: []
};

export const DEFAULT_PROFILE: UserProfile = {
    totalXp: 0,
    stealthLevel: 0,
    unlockedPerks: [],
    credits: 0,
    upgrades: {
        synapticWeave: 0,
        cryptoMiner: 0,
        signalDampener: 0,
        bufferExpansion: 0,
        focusLens: 0,
        patternScanner: 0
    },
    language: 'en',
    strictCase: false,
    pact: []
};

/**
 * Reads the stored profile synchronously, the way every other saved slice of this
 * app is read. It used to load in an effect, which left a render in which state
 * was still the default while the save effect was already running — see the note
 * on the save effect in App.
 */
export const loadStoredProfile = (): { profile: UserProfile; language?: Language; lastGenre?: StoryGenreId } => {
    try {
        const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (!saved) return { profile: DEFAULT_PROFILE };
        const parsed = JSON.parse(saved);
        const totalXp = Number.isFinite(parsed.totalXp) ? Math.max(0, parsed.totalXp) : 0;
        // Perfectionist predates the Pact and was the same idea with one clause,
        // so an existing player keeps it as the clause it always was.
        const pact = parsed.pact === undefined && parsed.strictCase
            ? (['strict_case'] as PactClauseId[])
            : normalizePact(parsed.pact);
        return {
            profile: {
                ...DEFAULT_PROFILE,
                ...parsed,
                totalXp,
                stealthLevel: getStealthLevel(totalXp),
                upgrades: { ...DEFAULT_PROFILE.upgrades, ...parsed.upgrades },
                pact,
                strictCase: pact.includes('strict_case')
            },
            language: parsed.language,
            lastGenre: GENRE_ORDER.includes(parsed.lastGenre) ? parsed.lastGenre : undefined
        };
    } catch (e) {
        console.error("Profile load fail", e);
        return { profile: DEFAULT_PROFILE };
    }
};
