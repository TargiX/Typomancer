import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readSkillStackAnchor,
  toggleSkillStackAnchor,
  writeSkillStackAnchor
} from '../services/skillStackAnchor.ts';

const memory = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); }
  };
};

test('skill stack defaults to the caret', () => {
  assert.equal(readSkillStackAnchor(memory()), 'caret');
});

test('skill stack remembers the corner until it is toggled back', () => {
  const storage = memory();
  writeSkillStackAnchor('corner', storage);
  assert.equal(readSkillStackAnchor(storage), 'corner');
  assert.equal(toggleSkillStackAnchor('corner'), 'caret');
});
