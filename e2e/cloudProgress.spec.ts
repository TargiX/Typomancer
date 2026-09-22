import { test, expect } from '@playwright/test';
import { DEFAULT_PROFILE } from '../services/profile';

test('guest import, independent device login, conflicting save and guest restoration', async ({ page, browser, baseURL }) => {
  test.skip(process.env.E2E_CLOUD_PROGRESS !== 'true', 'Requires disposable PostgreSQL and the progress API');
  const email = `browser-${crypto.randomUUID()}@example.invalid`;
  const password = crypto.randomUUID();
  await page.addInitScript(profile => {
    localStorage.setItem('narrativeFlowProfile', JSON.stringify({ ...profile, credits: 321, totalXp: 150 }));
  }, DEFAULT_PROFILE);
  await page.goto('/');
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Progress saving' });
  await panel.getByRole('button', { name: 'Sign in', exact: true }).click();
  await panel.getByRole('button', { name: 'New account', exact: true }).click();
  await panel.getByLabel('Email', { exact: true }).fill(email);
  await panel.getByLabel('Password (12+ characters)', { exact: true }).fill(password);
  await panel.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(panel.getByText(email, { exact: true })).toBeVisible();
  await expect.poll(async () => (await (await page.request.get('/api/progress')).json()).snapshot?.profile.credits).toBe(321);

  const device = await browser.newContext({ baseURL });
  const second = await device.newPage();
  try {
    await second.goto('/');
    await second.getByRole('button', { name: 'Account', exact: true }).click();
    const account = second.getByRole('region', { name: 'Progress saving' });
    await account.getByRole('button', { name: 'Sign in', exact: true }).click();
    await account.getByLabel('Email', { exact: true }).fill(email);
    await account.getByLabel('Password (12+ characters)', { exact: true }).fill(password);
    await account.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(account.getByText(email, { exact: true })).toBeVisible();
    const state = await (await device.request.get('/api/progress')).json();
    expect(state.snapshot.profile.credits).toBe(321);
    const update = await device.request.put('/api/progress', { headers: { Origin: new URL(baseURL!).origin }, data: {
      userId: state.userId, revision: state.revision, mutationId: crypto.randomUUID(),
      snapshot: { ...state.snapshot, profile: { ...state.snapshot.profile, credits: 654 } }
    } });
    expect(update.ok()).toBeTruthy();
    // A real in-app preference write on the stale first device, not a storage mock.
    await page.getByRole('button', { name: /THE PACT/i }).click();
    await page.getByRole('button', { name: /case/i }).click();
    await expect(panel.getByText('Another device has a newer save')).toBeVisible();
    await panel.getByRole('button', { name: 'Use cloud save', exact: true }).click();
    await expect(panel.getByText('Cloud save connected')).toBeVisible();
    await panel.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(panel.getByText('This device only')).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('narrativeFlowProfile')!).credits)).toBe(321);
    const snapshot = await (await device.request.get('/api/progress')).json();
    expect(snapshot.snapshot.profile.credits).toBe(654);
  } finally { await device.close(); }
});
