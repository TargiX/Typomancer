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
  // Signup bumps the account epoch, which remounts the app back on the menu.
  // The bump lands after the chip already shows the email, so wait for the
  // whole enter+sync cycle — the cloud save proves it finished — before
  // reopening the account screen.
  await expect.poll(async () => (await (await page.request.get('/api/progress')).json()).snapshot?.profile.credits).toBe(321);
  await page.getByRole('button', { name: 'Account', exact: true }).click();
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
    // Sign-in bumps the account epoch on this device too — the app remounts
    // onto the menu and the panel closes. Reopen before asserting.
    await expect.poll(async () => (await (await device.request.get('/api/progress')).json()).snapshot?.profile.credits).toBe(321);
    await second.getByRole('button', { name: 'Account', exact: true }).click();
    await expect(account.getByText(email, { exact: true })).toBeVisible();
    const state = await (await device.request.get('/api/progress')).json();
    expect(state.snapshot.profile.credits).toBe(321);
    const update = await device.request.put('/api/progress', { headers: { Origin: new URL(baseURL!).origin }, data: {
      userId: state.userId, revision: state.revision, mutationId: crypto.randomUUID(),
      snapshot: { ...state.snapshot, profile: { ...state.snapshot.profile, credits: 654 } }
    } });
    expect(update.ok()).toBeTruthy();
    // A real in-app preference write on the stale first device, not a storage
    // mock. The account screen is a full-viewport portal, so leave it first.
    await page.getByRole('button', { name: 'BACK TO DECK', exact: true }).click();
    await page.getByRole('button', { name: /Run difficulty/i }).click();
    await page.getByRole('button', { name: /THE PACT/i }).click();
    await page.getByRole('button', { name: /case/i }).click();
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    await expect(panel.getByText('Another device has a newer save')).toBeVisible();
    await panel.getByRole('button', { name: 'Use cloud save', exact: true }).click();
    // Resolving the conflict re-enters the account — another epoch remount.
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    await expect(panel.getByText('Cloud save connected')).toBeVisible();
    await panel.getByRole('button', { name: 'Sign out', exact: true }).click();
    // Sign-out bumps the epoch one last time.
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    await expect(panel.getByText('This device only')).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('narrativeFlowProfile')!).credits)).toBe(321);
    const snapshot = await (await device.request.get('/api/progress')).json();
    expect(snapshot.snapshot.profile.credits).toBe(654);
  } finally { await device.close(); }
});
