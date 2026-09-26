import { expect, test, type Page } from '@playwright/test';

const input = (page: Page) => page.getByRole('textbox', { name: /Typing practice input|Поле тренировки печати/ });
const active = (page: Page) => page.locator('.engine-type-scroll span.relative.inline-block');

async function typeLine(page: Page, errors = 0) {
  await expect(input(page)).toBeEnabled();
  await expect(input(page)).toHaveValue('');
  const text = await active(page).innerText();
  await page.waitForTimeout(100);
  for (let i = 0; i < errors; i++) {
    await input(page).pressSequentially('#');
    await input(page).press('Backspace');
  }
  await input(page).pressSequentially(text, { delay: 2 });
  await page.waitForTimeout(350);
  return text;
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/gemini', route => route.fulfill({ status: 503, body: '{}' }));
});

for (const path of [
  { name: 'rescue and protect Mira', rescue: true, redact: true, spotted: false, fragment: false, resume: true, ending: 'Two voices at dawn' },
  { name: 'abandon Mira and publish the original', rescue: false, redact: false, spotted: true, fragment: false, resume: false, ending: 'Proof without a witness' },
  { name: 'rescue Mira but damage the upload', rescue: true, redact: false, spotted: false, fragment: true, resume: false, ending: 'A surviving fragment' }
]) {
  test(`last relay: ${path.name}`, async ({ page }) => {
    let textRequests = 0;
    let imageRequests = 0;
    page.on('request', request => {
      if (request.method() !== 'POST' || !request.url().includes('/api/gemini')) return;
      try {
        const model = JSON.parse(request.postData() || '{}').model || '';
        if (String(model).includes('image')) imageRequests += 1;
        else textRequests += 1;
      } catch {
        textRequests += 1;
      }
    });
    await page.goto('/');
    await page.getByRole('button', { name: /^1 PLAY/ }).click();
    await expect(active(page)).toContainText('Mira whispers');
    await typeLine(page);
    await typeLine(page, path.spotted ? 6 : 0);
    await expect(active(page)).toContainText(path.spotted ? 'lift locks' : 'camera repeats');
    await typeLine(page);
    await page.getByRole('button', { name: path.rescue ? /Open Mira's door/ : /Copy the archive; leave Mira inside/ }).click();
    for (let round = 4; round <= 7; round++) await typeLine(page);
    await expect(page.locator('.screens-perk-card').first()).toBeEnabled();
    const checkpoint = await page.evaluate(() => JSON.parse(localStorage.getItem('typomancerRunCheckpoint')!));
    expect(checkpoint.nextLevel).toBe(2);
    expect(checkpoint.mission.flags).toContain(path.rescue ? 'relay:rescued' : 'relay:archive');
    expect(checkpoint.mission.flags).toContain(path.spotted ? 'relay:spotted' : 'relay:unseen');
    if (path.resume) {
      await page.reload();
      await page.getByRole('button', { name: /RESUME OPERATION/ }).click();
    } else {
      await page.locator('.screens-perk-card').first().click();
    }
    await expect(active(page)).toContainText(path.rescue ? 'Mira reaches' : 'rooftop alone');
    for (let round = 1; round <= 3; round++) await typeLine(page);
    await page.getByRole('button', { name: path.redact ? /Protect Mira's identity/ : /Publish the original/ }).click();
    for (let round = 4; round <= 6; round++) await typeLine(page);
    await typeLine(page, path.fragment ? 6 : 0);
    await expect(page.getByRole('heading', { name: path.ending, exact: true })).toBeVisible();
    await expect(page.getByText(path.fragment ? /only an unverified fragment/ : /publishes the evidence/).first()).toBeVisible();
    const persisted = await page.evaluate(() => ({
      checkpoint: localStorage.getItem('typomancerRunCheckpoint'),
      progress: JSON.parse(localStorage.getItem('typomancerPlayerProgress')!)
    }));
    expect(persisted.checkpoint).toBeNull();
    expect(persisted.progress.runs.at(-1).level).toBe(2);
    expect(textRequests).toBe(0);
    expect(imageRequests).toBeGreaterThan(0);
    if (path.redact) {
      await page.screenshot({ path: '.context/last-relay-ending.png', fullPage: true });
      await page.keyboard.press('Space');
      await page.getByRole('button', { name: /Other world/ }).click();
      await page.getByRole('button', { name: /Cyberpunk Espionage Operation Black Ledger/ }).click();
      await page.locator('.screens-perk-card').first().click();
      // The ordinary campaign keeps its introductory protocol briefing.
      await page.locator('.engine-skill-briefing-start').click();
      await expect(input(page)).toBeEnabled();
      await expect(active(page)).not.toContainText('Mira whispers');
      expect(textRequests).toBeGreaterThan(0);
    }
  });
}

test('Russian quick start', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'RU', exact: true }).first().click();
  await page.getByRole('button', { name: /^1 ИГРАТЬ/ }).click();
  await expect(active(page)).toContainText('Мира шепчет');
  await typeLine(page);
  await expect(active(page)).toContainText('запись камеры');
});

 test('menu keeps its title and quick start on screen at laptop height', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  const heading = page.getByRole('heading', { name: 'Operation Black Ledger', exact: true });
  await expect(heading).toBeInViewport({ ratio: 1 });
  const quickStart = page.getByRole('button', { name: /^1 PLAY/ });
  await expect(quickStart).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: /Run difficulty/ }).click();
  await page.getByRole('button', { name: /THE PACT/ }).click();
  await quickStart.scrollIntoViewIfNeeded();
  await expect(quickStart).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: '.context/last-relay-menu.png', fullPage: true });
});
