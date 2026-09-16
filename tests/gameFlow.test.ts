import assert from 'node:assert/strict';
import test from 'node:test';

import { GameState } from '../types.ts';
import { GAME_FLOW_TRANSITIONS, isLegalGameTransition } from '../services/gameFlow.ts';

test('transition table covers every game state and only names real states', () => {
    for (const state of Object.values(GameState)) {
        assert.ok(Array.isArray(GAME_FLOW_TRANSITIONS[state]), `missing row for ${state}`);
        for (const target of GAME_FLOW_TRANSITIONS[state]) {
            assert.ok(Object.values(GameState).includes(target), `${state} -> ${target} is not a GameState`);
        }
    }
});

test('the campaign loop is walkable end to end', () => {
    const path = [
        GameState.MENU,
        GameState.GENRE_SELECTION,
        GameState.STARTER_PERK_SELECTION,
        GameState.LOADING,
        GameState.PLAYING,
        GameState.LEVEL_COMPLETE,
        GameState.LOADING,
        GameState.PLAYING,
        GameState.VICTORY,
        GameState.MENU
    ];
    for (let i = 1; i < path.length; i++) {
        assert.equal(isLegalGameTransition(path[i - 1], path[i]), true, `${path[i - 1]} -> ${path[i]}`);
    }
});

test('daily run bypasses genre selection; checkpoint resume skips it too', () => {
    assert.equal(isLegalGameTransition(GameState.MENU, GameState.STARTER_PERK_SELECTION), true);
    assert.equal(isLegalGameTransition(GameState.MENU, GameState.LOADING), true);
});

test('impossible jumps are rejected', () => {
    assert.equal(isLegalGameTransition(GameState.MENU, GameState.PLAYING), false);
    assert.equal(isLegalGameTransition(GameState.PLAYING, GameState.MENU), false);
    assert.equal(isLegalGameTransition(GameState.LOADING, GameState.MENU), false);
    assert.equal(isLegalGameTransition(GameState.VICTORY, GameState.PLAYING), false);
    assert.equal(isLegalGameTransition(GameState.BLACK_MARKET, GameState.PLAYING), false);
});

test('staying in the same state is always legal', () => {
    for (const state of Object.values(GameState)) {
        assert.equal(isLegalGameTransition(state, state), true);
    }
});
