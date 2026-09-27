import { test, expect, type Page } from '@playwright/test';
test.setTimeout(60000);
test.beforeEach(async ({ page }) => {
  await page.route('**/api/gemini', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
});
const input = (page: Page) => page.getByRole('textbox', { name: 'Typing practice input' });
const line = (page: Page) => page.locator('.engine-type-scroll span.relative.inline-block');
const typeLine = async (page: Page) => {
  const text = await line(page).innerText();
  await expect(input(page)).toBeEnabled();
  // 8 ms per key: fast enough for a sector, slow enough not to outrun the line under parallel load.
  await input(page).pressSequentially(text, { delay: 8 });
  return text;
};
test('with timed choices off, a story choice waits beyond the fuse and keeps keyboard focus', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('typomancerPlayPreferences', JSON.stringify({ timedDecisions: false, clearText: true })));
  await page.goto('/');
  await page.locator('[data-hotkey="1"]').click();
  for (let i = 0; i < 3; i++) { const text = await typeLine(page); if (i < 2) await expect(line(page)).not.toHaveText(text); }
  const choice = page.getByRole('dialog', { name: /Mira|relay|camera|broadcast/i });
  const buttons = page.locator('.engine-decision-overlay button');
  await expect(buttons).toHaveCount(2);
  await expect(buttons.first()).toBeFocused();
  await page.clock.install();
  await page.clock.fastForward(30000);
  await expect(buttons).toHaveCount(2);
  await expect(page.locator('.engine-decision-question')).toHaveCSS('font-style', 'normal');
  await page.screenshot({ path: '.context/trainer-choice.png', fullPage: true, animations: 'disabled' });
  await page.keyboard.press('Tab');
  await expect(buttons.last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(buttons.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(buttons.last()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(input(page)).toBeEnabled();
  expect(await choice.count()).toBe(0);
});
test('by default a story choice runs on a fuse and the loud option fires at zero', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-hotkey="1"]').click();
  for (let i = 0; i < 3; i++) { const text = await typeLine(page); if (i < 2) await expect(line(page)).not.toHaveText(text); }
  const buttons = page.locator('.engine-decision-overlay button');
  await expect(buttons).toHaveCount(2);
  await expect(page.locator('.engine-decision-fuse')).toBeVisible();
  // Real time: the 12-second fuse burns down and chooses for the player.
  await expect(buttons).toHaveCount(0, { timeout: 16000 });
  await expect(input(page)).toBeEnabled();
});
test('reading settings persist, remap keys, leave Tab available and fit a narrow Russian screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'RU', exact: true }).click();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Настройки' });
  await dialog.getByLabel('Размер текста').selectOption('28');
  await dialog.getByLabel('Уменьшить движение и вспышки').check();
  await dialog.getByLabel('Чёткий текст без курсива').check();
  await dialog.getByRole('combobox', { name: 'Фокус', exact: true }).selectOption('F3');
  await page.screenshot({ path: '.context/trainer-settings-mobile.png', fullPage: true });
  await dialog.getByRole('button', { name: 'Готово' }).click();
  await page.reload();
  await page.locator('[data-hotkey="1"]').click();
  await expect(page.locator('[data-motion="reduced"]')).toHaveCount(1);
  await expect(page.locator('.engine-prose')).toHaveCSS('font-size', '28px');
  await expect(page.locator('.ch-todo').first()).toHaveCSS('color', 'rgb(214, 211, 220)');
  await page.getByRole('textbox').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox')).not.toBeFocused();
  const source = await line(page).innerText();
  await page.getByRole('textbox').pressSequentially(source.slice(0, 50), { delay: 2 });
  await expect(page.locator('[data-hotkey="f3"]')).toBeVisible();
  await page.keyboard.press('F3');
  await expect(page.locator('.engine-caret--focus')).toHaveCount(1);
  expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
});
test('repair mode waits for correction and preserves physical mistakes after sending', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('typomancerPlayPreferences', JSON.stringify({ campaignGoal: 'repair' })));
  await page.goto('/'); await page.locator('[data-hotkey="1"]').click();
  const text = await line(page).innerText();
  await input(page).pressSequentially('#' + text.slice(1), { delay: 2 });
  await expect(page.getByRole('status')).toContainText('Backspace');
  await expect(line(page)).toHaveText(text);
  for (let i = 0; i < text.length; i++) await input(page).press('Backspace');
  await input(page).pressSequentially(text, { delay: 2 });
  await expect(line(page)).not.toHaveText(text);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('typomancerRunCheckpoint')!));
  expect(saved.context.campaignGoal).toBe('repair');
  expect(saved.context.storyLog[0].mistakes).toBe(1);
  expect(saved.context.storyLog[0].attempts).toBe(text.length * 2);
});
test('pause can open settings and exit, then resume the saved line with working input', async ({ page }) => {
  await page.goto('/'); await page.locator('[data-hotkey="1"]').click();
  const text = await typeLine(page); await expect(line(page)).not.toHaveText(text);
  const next = await line(page).innerText();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog', { name: 'Paused', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to menu', exact: true }).click();
  await page.locator('[data-hotkey="r"]').click();
  await expect(line(page)).toHaveText(next);
  await input(page).pressSequentially(next.slice(0, 3));
  await expect(input(page)).toHaveValue(next.slice(0, 3));
});
test('Daily admission is persisted immediately, upgrades and pact do not change its starting health', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('narrativeFlowProfile') || '{"upgrades":{}}');
    localStorage.setItem('narrativeFlowProfile', JSON.stringify({ ...p, totalXp: 10000, stealthLevel: 20, relaxed: true, strictCase: true, pact: ['hunted', 'hot_start', 'strict_case', 'no_grace'], upgrades: { ...p.upgrades, synapticWeave: 5, signalDampener: 5, cryptoMiner: 5 } }));
    localStorage.setItem('narrativeFlowSkillBriefingSeen', '1');
  });
  await page.reload();
  await page.locator('[data-hotkey="3"]').click();
  const daily = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('nfDaily:')).map(k => ({ key: k, ...JSON.parse(localStorage.getItem(k)!) })));
  expect(daily).toHaveLength(1);
  expect(daily[0].key).toMatch(/_en_daily-v2$/);
  expect(daily[0].attemptsUsed).toBe(1);
  await page.getByRole('button', { name: /^1 COMMON/ }).click();
  await expect(input(page)).toBeEnabled();
  await expect(page.locator('.engine-training-goal')).toHaveCount(0);
  await expect(page.locator('.engine-vrail-left')).toHaveAttribute('title', /20\/20$/);
  await page.reload();
  await expect(page.locator('[data-hotkey="3"]')).toContainText('2/3');
});
test('versioned Russian share opens in its language with a comparable challenge', async ({ page }) => {
  const id = 'SECTOR-' + new Date().toISOString().slice(0, 10).replaceAll('-', '');
  await page.goto(`/?challenge=${id}&target=500&rules=daily-v2&lang=ru`);
  await expect(page.getByRole('button', { name: 'Настройки', exact: true })).toBeVisible();
  await expect(page.getByText('Неформальный вызов: язык или правила отличаются.')).toHaveCount(0);
});


test('practice from a sector debrief returns to the same earned perk choice', async ({ page }) => {
  await page.goto('/'); await page.locator('[data-hotkey="1"]').click();
  for (let round = 1; round <= 7; round++) {
    const text = await typeLine(page);
    if (round === 3) await page.locator('.engine-decision-overlay button').first().click();
    if (round < 7) await expect(line(page)).not.toHaveText(text);
  }
  await expect(page.getByRole('heading', { name: 'SEQUENCE COMPLETE' })).toBeVisible();
  const perks = await page.locator('.screens-perk-card').allTextContents();
  expect(perks).toHaveLength(3);
  const wallet = await page.evaluate(() => JSON.parse(localStorage.getItem('narrativeFlowProfile')!).credits);
  await page.getByRole('button', { name: 'Practice · 5 min', exact: true }).click();
  await page.clock.install();
  for (let phase = 0; phase < 3; phase++) {
    await page.getByRole('button', { name: 'Start stage' }).click();
    const field = page.getByRole('textbox', { name: 'Type the practice passage' });
    const text = await page.locator('.practice-transmission').innerText();
    await field.pressSequentially(text.slice(0, 1));
    await page.clock.fastForward(phase === 1 ? 180000 : 60000);
  }
  await page.getByRole('button', { name: 'Use it in a story' }).click();
  await expect(page.getByRole('heading', { name: 'SEQUENCE COMPLETE' })).toBeVisible();
  await expect(page.locator('.screens-perk-card')).toHaveText(perks);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('narrativeFlowProfile')!).credits)).toBe(wallet);
});
