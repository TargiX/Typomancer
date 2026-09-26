import { expect, test, type Page } from '@playwright/test';

const installReturningPlayer = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('typomancerPlayerProgress', JSON.stringify({
      version: 1,
      calibration: {
        wpm: 50,
        accuracy: 97,
        durationMs: 30_000,
        completedAt: '2026-08-23T00:00:00.000Z',
        preset: 'balanced'
      },
      runs: []
    }));
    localStorage.setItem('narrativeFlowSkillBriefingSeen', '1');
  });
  await page.route('**/api/gemini', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline in e2e"}' });
  });
};

const startCampaign = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Other world/ }).click();
  await page.getByRole('button', { name: /Cyberpunk Espionage Operation Black Ledger/ }).click();
  await page.locator('.screens-perk-card').first().click();
  await expect(page.getByRole('textbox', { name: 'Typing practice input' })).toBeEnabled();
};

const typeActiveLine = async (page: Page) => {
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const activeLine = page.locator('.engine-type-scroll span.relative.inline-block');
  const text = await activeLine.innerText();
  await expect(input).toHaveValue('');
  // TypingEngine briefly locks input while handing one completed line to the
  // next. Give that 50 ms transition time to release before sending characters.
  await page.waitForTimeout(75);
  await input.pressSequentially(text, { delay: 5 });

  // The player reproduces this line keystroke by keystroke, so a malformed one is
  // a defect they are forced to copy. Drill lines are exact by definition.
  const isDrill = /^>>|\/\//.test(text);
  if (!isDrill) {
    expect(text, `line should open with a capital: ${text}`).not.toMatch(/^\p{Ll}/u);
    expect(text, `line should end with terminal punctuation: ${text}`).toMatch(/[.!?…]["'»”’)\]]?$/);
  }
  return text;
};

test.beforeEach(async ({ page }) => {
  await installReturningPlayer(page);
});

test('bulk insertion cannot complete a typing line', async ({ page }) => {
  await startCampaign(page);
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const text = await page.locator('.engine-type-scroll span.relative.inline-block').innerText();

  await input.fill(text);

  // Nothing was accepted and nothing was paid for: the line is untouched and the
  // run has earned nothing. Credits read from the HUD; the shell column is gone.
  await expect(input).toHaveValue('');
  await expect(page.getByText('CREDITS').locator('..')).toContainText('0');
});

test('the caret only offers skills the player can cast, and unlocks stack upward', async ({ page }) => {
  await startCampaign(page);
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const activeText = await page.locator('.engine-type-scroll span.relative.inline-block').innerText();
  const stack = page.locator('.engine-cursor-skills');
  const labels = stack.locator('.engine-cursor-skill-label');

  // Energy starts empty, so there is nothing to offer and nothing to render.
  await expect(labels).toHaveCount(0);

  await input.pressSequentially(activeText.slice(0, 20), { delay: 5 });
  await expect(labels).toHaveText(['FIREWALL']);
  const before = await stack.locator('.engine-cursor-skill').last().evaluate((element) => ({
    bottom: element.getBoundingClientRect().bottom,
    rowHeight: element.getBoundingClientRect().height
  }));

  await input.pressSequentially(activeText.slice(20, 28), { delay: 5 });
  await expect(labels).toHaveText(['PURGE', 'FIREWALL']);

  const geometry = await stack.evaluate((element) => ({
    direction: getComputedStyle(element).flexDirection,
    bottomLabel: element.lastElementChild?.querySelector('.engine-cursor-skill-label')?.textContent,
    bottomEdge: element.lastElementChild?.getBoundingClientRect().bottom ?? 0
  }));
  expect(geometry.direction).toBe('column-reverse');
  // The cheapest unlock stays put by the caret; PURGE arrived below it. The stack
  // is anchored to the caret, which drifts sub-pixel as the line advances, so the
  // claim worth testing is that FIREWALL did not get pushed by a whole row.
  expect(geometry.bottomLabel).toBe('FIREWALL');
  expect(Math.abs(geometry.bottomEdge - before.bottom)).toBeLessThan(before.rowHeight / 2);

  // Nothing in the stack is ever a dead key.
  await expect(stack.locator('.engine-cursor-skill:disabled')).toHaveCount(0);
});

test('the tracer eats the line behind a stalled player and PURGE throws it back', async ({ page }) => {
  await startCampaign(page);
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const activeText = await page.locator('.engine-type-scroll span.relative.inline-block').innerText();
  const burned = page.locator('.tracer-burned');

  // Opening a line and reading it is free: the chase has not armed yet.
  await expect(burned).toHaveCount(0);

  // Build a lead, then stop dead. TRACER_GRACE_MS is 3s from the first keystroke.
  // Keep Date.now fixed while typing: a busy CI runner can take more than the
  // grace period to deliver 40 key events. Animation frames still run normally.
  const typingStartedAt = Date.now();
  await page.clock.setFixedTime(typingStartedAt);
  await input.pressSequentially(activeText.slice(0, 40), { delay: 5 });
  await expect(burned).toHaveCount(0);

  // The burn front now marches into the lead we just built.
  await page.clock.setFixedTime(typingStartedAt + 4000);
  await expect
    .poll(async () => burned.count(), { timeout: 20_000, message: 'tracer should consume the line behind a stalled caret' })
    .toBeGreaterThan(4);

  const beforePurge = await burned.count();
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(async () => burned.count(), { timeout: 5_000, message: 'PURGE should throw the burn front back' })
    .toBeLessThan(beforePurge);
});

test('a lost branch shows the player the line clean typing would have earned', async ({ page }) => {
  await startCampaign(page);
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const activeText = await page.locator('.engine-type-scroll span.relative.inline-block').innerText();
  const reveal = page.locator('.engine-fork-reveal');

  await expect(reveal).toHaveCount(0);

  // Enough uncorrected typos to lose the good branch (more than 4 counted), but
  // short of the 10 that end the run — which would take the input away mid-test.
  const typoCount = 7;
  const wrong = activeText.slice(0, typoCount).replace(/./g, (character) => (character === 'z' ? 'q' : 'z'));
  await input.pressSequentially(wrong, { delay: 5 });
  await input.pressSequentially(activeText.slice(typoCount), { delay: 5 });

  await expect(reveal).toHaveClass(/engine-fork-reveal--bad/);
  await expect(reveal.locator('.engine-fork-missed-text')).not.toBeEmpty();
});

test('a clean line is never told what it missed', async ({ page }) => {
  await startCampaign(page);
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const activeText = await page.locator('.engine-type-scroll span.relative.inline-block').innerText();
  const reveal = page.locator('.engine-fork-reveal');

  await input.pressSequentially(activeText, { delay: 5 });

  await expect(reveal).toHaveClass(/engine-fork-reveal--good/);
  await expect(reveal.locator('.engine-fork-missed-text')).toHaveCount(0);
});

test('ready skills sit under the caret, not in the corner', async ({ page }) => {
  await startCampaign(page);
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const activeText = await page.locator('.engine-type-scroll span.relative.inline-block').innerText();

  await input.pressSequentially(activeText.slice(0, 32), { delay: 5 });
  await expect(page.locator('.engine-cursor-skills')).toBeVisible();

  const geometry = await page.evaluate(() => {
    const stack = document.querySelector('.engine-cursor-skills')?.getBoundingClientRect();
    const caret = document.querySelector('.engine-caret')?.getBoundingClientRect();
    if (!stack || !caret) return null;
    return {
      dx: Math.abs((stack.left + stack.width / 2) - (caret.left + caret.width / 2)),
      belowCaret: stack.top >= caret.bottom - 2,
      inCorner: stack.right > window.innerWidth - 48 && stack.bottom > window.innerHeight - 48
    };
  });
  expect(geometry).not.toBeNull();
  expect(geometry!.inCorner).toBe(false);
  expect(geometry!.belowCaret).toBe(true);
  expect(geometry!.dx).toBeLessThan(80);
});

test('ready skills can sit in the corner when that layout is chosen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByLabel('Skills in the corner, not at the cursor').check();
  await settings.getByRole('button', { name: 'Done' }).click();
  await startCampaign(page);
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const activeText = await page.locator('.engine-type-scroll span.relative.inline-block').innerText();
  await input.pressSequentially(activeText.slice(0, 32), { delay: 5 });
  await expect(page.locator('.engine-cursor-skills')).toBeVisible();

  const geometry = await page.evaluate(() => {
    const stack = document.querySelector('.engine-cursor-skills')?.getBoundingClientRect();
    const panel = document.querySelector('.engine-type-panel')?.getBoundingClientRect();
    const caret = document.querySelector('.engine-caret')?.getBoundingClientRect();
    if (!stack || !panel || !caret) return null;
    return {
      inPanelCorner: stack.right > panel.right - 40 && stack.bottom > panel.bottom - 40,
      dx: Math.abs((stack.left + stack.width / 2) - (caret.left + caret.width / 2)),
      direction: getComputedStyle(document.querySelector('.engine-cursor-skills')!).flexDirection
    };
  });
  expect(geometry).not.toBeNull();
  expect(geometry!.inPanelCorner).toBe(true);
  expect(geometry!.dx).toBeGreaterThan(80);
  expect(geometry!.direction).toBe('column');
});

test('a newcomer reaches the story without sitting a typing test first', async ({ page }) => {
  await page.addInitScript(() => {
    const audio = ['typomancerAudioEnabled', 'typomancerMusicEnabled', 'typomancerSfxVolume', 'typomancerMusicVolume']
      .map(key => [key, localStorage.getItem(key)] as const)
      .filter((entry): entry is readonly [string, string] => entry[1] !== null);
    localStorage.clear();
    for (const [key, value] of audio) localStorage.setItem(key, value);
  });
  await page.goto('/');

  await page.getByRole('button', { name: /Other world/ }).click();

  // Calibration used to be the first thing a stranger saw: 93 characters to type
  // before the game had shown them anything. The baseline tracks real runs now.
  await expect(page.locator('.calibration-panel')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Cyberpunk Espionage/ })).toBeVisible();
});

test('a protocol explains itself the first time it can be cast', async ({ page }) => {
  await startCampaign(page);
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const activeText = await page.locator('.engine-type-scroll span.relative.inline-block').innerText();

  // Nothing is castable yet, so nothing is being taught yet.
  await expect(page.locator('.engine-cursor-skill--introducing')).toHaveCount(0);

  await input.pressSequentially(activeText.slice(0, 20), { delay: 5 });

  const introducing = page.locator('.engine-cursor-skill--introducing');
  await expect(introducing).toHaveCount(1);
  await expect(introducing).toContainText('FIREWALL');
  // The effect is readable without hovering, which is the whole point.
  await expect(introducing.locator('.engine-cursor-skill-effect')).toBeVisible();
});

test('the Pact raises the bar and pays for it', async ({ page }) => {
  await page.goto('/');
  const clauses = page.locator('.screens-pact-clause');
  const reward = page.locator('.screens-pact-reward');
  // The Pact lives inside the folded run-difficulty panel.
  await page.getByRole('button', { name: /Run difficulty/ }).click();

  // Collapsed by default: five clauses expanded is a wall of text on the first
  // screen, and the multiplier alone says whether anything is taken on.
  await expect(reward).toContainText('x1.00');
  await expect(clauses).toHaveCount(0);
  await page.getByRole('button', { expanded: false }).filter({ hasText: 'THE PACT' }).click();
  await expect(clauses.locator('.is-active')).toHaveCount(0);

  const count = await clauses.count();
  for (let i = 0; i < count; i += 1) await clauses.nth(i).click();

  // Every clause pays, so a full Pact more than doubles the run.
  await expect(reward).toContainText('x2.25');
  const multiplier = Number((await reward.innerText()).match(/x([\d.]+)/)![1]);
  expect(multiplier).toBeGreaterThan(2);

  // Taking one back lowers the payout rather than sticking.
  await clauses.first().click();
  await expect(reward).not.toContainText('x2.25');

  // And the choice survives a reload, because it is a standing commitment —
  // even though the panel itself reopens collapsed.
  const before = await reward.innerText();
  await page.reload();
  await page.getByRole('button', { name: /Run difficulty/ }).click();
  await expect(page.locator('.screens-pact-reward')).toHaveText(before);
  await expect(page.locator('.screens-pact-clause')).toHaveCount(0);
});

test('a Pact clause changes the run it was taken for', async ({ page }) => {
  await page.addInitScript(() => {
    const raw = localStorage.getItem('narrativeFlowProfile');
    const profile = raw ? JSON.parse(raw) : {};
    localStorage.setItem('narrativeFlowProfile', JSON.stringify({ ...profile, pact: ['hot_start'] }));
  });
  await startCampaign(page);

  // Hot Start opens the sector already hunted, against a default of 18%. Heat
  // reads from the HUD mission rail now: the shell column is gone during a run.
  const heatMeter = page.locator('.engine-mission-meter').filter({ hasText: 'HEAT' });
  await expect(heatMeter).toContainText('45%');
});

test('banking a completed sector adds it to Operator Record', async ({ page }) => {
  // Run it under a Pact so the record has something to distinguish it by.
  await page.addInitScript(() => {
    const raw = localStorage.getItem('narrativeFlowProfile');
    const profile = raw ? JSON.parse(raw) : {};
    localStorage.setItem('narrativeFlowProfile', JSON.stringify({ ...profile, pact: ['hot_start', 'hunted'] }));
  });
  await startCampaign(page);
  const activeLine = page.locator('.engine-type-scroll span.relative.inline-block');

  const beats: string[] = [];
  for (let round = 1; round <= 7; round += 1) {
    beats.push((await page.locator('.engine-beat').innerText()).trim());
    const completedText = await typeActiveLine(page);
    if (round === 3) {
      await page.getByRole('button', { name: /STEALTH/ }).click();
      await expect(activeLine).not.toHaveText(completedText);
    } else if (round < 7) {
      await expect(activeLine).not.toHaveText(completedText);
    }
  }

  // The sector runs on an authored curve, so it opens gently and ends on a climax
  // rather than being seven interchangeable beats.
  expect(beats[0]).toBe('OPENING');
  expect(beats[beats.length - 1]).toBe('CLIMAX');
  expect(new Set(beats).size).toBeGreaterThan(2);

  await expect(page.getByRole('heading', { name: 'SEQUENCE COMPLETE' })).toBeVisible();

  // Accuracy leads the debrief; speed is one tile among the rest. This is an
  // accuracy trainer, and the screen used to open with a speed number.
  const hero = page.locator('.screens-accuracy-hero');
  await expect(hero).toBeVisible();
  await expect(hero.locator('.screens-accuracy-value')).toContainText('%');
  const heroBox = await hero.boundingBox();
  const speedTile = page.locator('.screens-stat-tile').first();
  const speedBox = await speedTile.boundingBox();
  expect(heroBox!.y).toBeLessThan(speedBox!.y);
  expect(heroBox!.height).toBeGreaterThan(speedBox!.height * 0.9);

  await page.getByRole('button', { name: 'SAVE & EXIT' }).click();
  await expect(page.getByRole('button', { name: /RESUME OPERATION · Sector 2/ })).toBeVisible();
  await page.getByRole('button', { name: /OPERATOR RECORD/ }).click();

  await expect(page.locator('.operator-record-run')).toContainText('BANKED');
  // A Pact run must read as one afterwards, or taking the hard road leaves no trace.
  await expect(page.locator('.operator-record-run .operator-record-pact')).toContainText('x1.50');

  const storedPact = await page.evaluate(
    () => JSON.parse(localStorage.getItem('typomancerPlayerProgress') || '{}').runs?.[0]?.pact
  );
  expect(storedPact).toEqual(['hot_start', 'hunted']);
  await expect(page.locator('.operator-record-run')).toContainText('LVL 1');
});

test('mobile mistakes show the impact sequence, debrief, and recorded defeat', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startCampaign(page);
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const activeText = await page.locator('.engine-type-scroll span.relative.inline-block').innerText();
  const failureHeading = page.getByRole('heading', { name: 'CRITICAL FAILURE' });
  let attemptedErrors = 0;

  for (let index = 0; index < Math.min(16, activeText.length); index += 1) {
    const wrongCharacter = activeText[index].toLowerCase() === 'x' ? 'z' : 'x';
    await input.press(wrongCharacter);
    attemptedErrors += 1;
    if (await failureHeading.isVisible()) break;
    await page.waitForTimeout(20);
  }

  await expect(page.getByRole('alert')).toContainText('SIGNAL LOST');
  await expect(failureHeading).toBeVisible();
  // The report includes the grace/shield error as well as the ten damaging ones.
  await expect(page.getByText('Mistakes').locator('..')).toContainText(String(attemptedErrors));
  const viewportMetrics = await page.locator('body').evaluate((body) => ({
    clientWidth: body.clientWidth,
    scrollWidth: body.scrollWidth
  }));
  expect(viewportMetrics.scrollWidth).toBeLessThanOrEqual(viewportMetrics.clientWidth);

  await expect(page.getByRole('alert')).toBeHidden();
  await page.getByRole('button', { name: /MAIN MENU/ }).click();
  await page.getByRole('button', { name: /OPERATOR RECORD/ }).click();
  await expect(page.locator('.operator-record-run')).toContainText('SEVERED');
});

test("a returning player's Play goes straight into a rotated world with its focus perk", async ({ page }) => {
  await page.addInitScript(() => {
    const endedAt = new Date(Date.now() - 3600_000).toISOString();
    localStorage.setItem('typomancerPlayerProgress', JSON.stringify({ version: 1, calibration: null, hasMovedPastPrologue: true, runs: [{
      id: 'played-cyberpunk', endedAt, dateKey: endedAt.slice(0, 10), outcome: 'victory', daily: false, genre: 'cyberpunk',
      level: 4, score: 900, wpm: 60, bestWpm: 70, accuracy: 93, consistency: 90, mistakes: 8, characters: 1200,
      durationSeconds: 600, focus: 'accuracy', pact: [], language: 'en', measurementVersion: 2
    }] }));
  });
  await page.goto('/');
  const play = page.locator('[data-hotkey="1"]');
  await expect(play).toContainText('Space Horror');
  await expect(play).toContainText('focus: accuracy');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Typing practice input' })).toBeEnabled();
  // No world or perk picker on the way in; the run wears the next world's colourway.
  await expect(page.locator('.screens-world-card')).toHaveCount(0);
  await expect(page.locator('[data-colorway]')).toHaveAttribute('data-colorway', 'abyss');
});
