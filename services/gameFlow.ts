import { GameState } from '../types.ts';
import type { StoryGenreId } from '../types.ts';
import type { DailyBrief } from './dailyMode.ts';

/**
 * The session loop is a statechart, not a pile of setters. Every legal
 * GameState edge is listed here; App routes transitions through a checked
 * setter so an impossible jump (e.g. MENU -> PLAYING) warns instead of
 * silently rendering a half-initialised screen.
 *
 * UPGRADES is a legacy state nothing enters anymore; it may only leave.
 */
export const GAME_FLOW_TRANSITIONS: Readonly<Record<GameState, readonly GameState[]>> = {
    [GameState.MENU]: [
        GameState.GENRE_SELECTION,      // new campaign
        GameState.STARTER_PERK_SELECTION, // daily sector skips genre pick
        GameState.BLACK_MARKET,
        GameState.OPERATOR_RECORD,
        GameState.LOADING               // resume checkpoint
    ],
    [GameState.GENRE_SELECTION]: [GameState.MENU, GameState.STARTER_PERK_SELECTION],
    [GameState.STARTER_PERK_SELECTION]: [GameState.LOADING],
    [GameState.LOADING]: [GameState.PLAYING],
    [GameState.PLAYING]: [GameState.LEVEL_COMPLETE, GameState.VICTORY, GameState.GAME_OVER],
    [GameState.LEVEL_COMPLETE]: [GameState.LOADING, GameState.MENU],
    [GameState.CALIBRATION]: [
        GameState.OPERATOR_RECORD,      // drill / recalibration returns to record
        GameState.STARTER_PERK_SELECTION, // pre-daily calibration continues the run
        GameState.GENRE_SELECTION       // pre-campaign calibration continues the run
    ],
    [GameState.OPERATOR_RECORD]: [GameState.MENU, GameState.CALIBRATION],
    [GameState.BLACK_MARKET]: [GameState.MENU],
    [GameState.VICTORY]: [GameState.MENU],
    [GameState.GAME_OVER]: [GameState.MENU],
    [GameState.UPGRADES]: [GameState.MENU]
};

export function isLegalGameTransition(from: GameState, to: GameState): boolean {
    return from === to || GAME_FLOW_TRANSITIONS[from].includes(to);
}

/**
 * Run-flow context that async handlers need between renders. Kept in one ref
 * object instead of six scattered useRefs so "what does this session think it
 * is" has a single place to look — and a single place to freeze at launch.
 */
export interface SessionFlow {
    genre: StoryGenreId;
    isDaily: boolean;
    dailyId: string | null;
    dailyBrief: DailyBrief;
    calibrationMode: 'calibration' | 'drill';
    calibrationNext: 'campaign' | 'daily' | 'record';
}

export function createSessionFlow(genre: StoryGenreId, dailyBrief: DailyBrief): SessionFlow {
    return {
        genre,
        isDaily: false,
        dailyId: null,
        dailyBrief,
        calibrationMode: 'calibration',
        calibrationNext: 'campaign'
    };
}
