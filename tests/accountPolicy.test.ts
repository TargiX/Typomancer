import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deletionHasPassword, deletionMatchesAccount } from '../server/accountPolicy.ts';

test('deletion requires a bounded password even for a fresh session', () => {
  for (const body of [null, {}, { password: '' }, { password: 'short' }, { password: 123 }, { password: 'x'.repeat(129) }]) {
    assert.equal(deletionHasPassword(body), false);
  }
  assert.equal(deletionHasPassword({ password: 'a-valid-password' }), true);
});
test('deletion binds explicit confirmation to the signed-in user, not another tab account', () => {
  assert.equal(deletionMatchesAccount('A'), false);
  const request = new Request('https://example.com', { headers: { 'x-typomancer-delete-account': 'A' } });
  assert.equal(deletionMatchesAccount('A', request), true);
  assert.equal(deletionMatchesAccount('B', request), false);
});
