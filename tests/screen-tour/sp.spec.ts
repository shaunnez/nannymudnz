/**
 * Single-player screen tour.
 *
 * Tests are split into three groups:
 *   1. Deep-link — pure React screens, fast (< 5 s each)
 *   2. Game screens — require Phaser boot (up to 90 s each)
 *   3. Overlays — require game to be running, then interact
 *
 * Each test takes a screenshot to screen-tour-report/raw/<id>.png and
 * attaches any console errors as annotations for the markdown reporter.
 */

import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { SP_VISITS, GAME_VISITS, OVERLAY_VISITS } from './manifest';

const RAW_DIR = 'screen-tour-report/raw';

test.beforeAll(() => {
  fs.mkdirSync(RAW_DIR, { recursive: true });
});

// ── Helper ──────────────────────────────────────────────────────────────────

async function shot(page: import('@playwright/test').Page, id: string) {
  await page.screenshot({
    path: path.join(RAW_DIR, `${id}.png`),
    fullPage: false,
  });
}

function attachErrors(page: import('@playwright/test').Page): () => string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`[page-error] ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
  });
  return () => errors;
}

// ── 1. Deep-link SP screens ─────────────────────────────────────────────────

for (const visit of SP_VISITS) {
  test(visit.id, { timeout: visit.timeout ?? 30_000 }, async ({ page }) => {
    const getErrors = attachErrors(page);

    await page.goto(visit.url!);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    await shot(page, visit.id);

    const errors = getErrors();
    if (errors.length > 0) {
      test.info().annotations.push({
        type: 'console-errors',
        description: errors.join('\n'),
      });
    }
  });
}

// ── 2. In-game screens (Phaser boot required) ────────────────────────────────

for (const visit of GAME_VISITS) {
  test(visit.id, { timeout: visit.timeout ?? 90_000 }, async ({ page }) => {
    const getErrors = attachErrors(page);

    await page.goto(visit.url!);

    // Step A — capture the loading screen (Phaser booting)
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    await shot(page, `${visit.id}-loading`);
    fs.mkdirSync(RAW_DIR, { recursive: true }); // ensure dir exists for sub-shot

    // Step B — wait for Phaser canvas (created immediately; might be under the loading overlay)
    await page.waitForSelector('canvas', { state: 'attached', timeout: 60_000 });
    await page.waitForTimeout(1_500); // allow first few frames to render

    await shot(page, visit.id);

    const errors = getErrors();
    if (errors.length > 0) {
      test.info().annotations.push({
        type: 'console-errors',
        description: errors.join('\n'),
      });
    }
  });
}

// ── 3. Overlay: pause screen ─────────────────────────────────────────────────

for (const visit of OVERLAY_VISITS) {
  test(visit.id, { timeout: visit.timeout ?? 90_000 }, async ({ page }) => {
    if (visit.id !== 'overlay-pause') return;
    const getErrors = attachErrors(page);

    await page.goto(visit.url!);
    await page.waitForSelector('canvas', { state: 'attached', timeout: 60_000 });
    await page.waitForTimeout(1_500);

    // Press P to open the pause overlay
    await page.keyboard.press('p');
    await page.waitForTimeout(300);
    await shot(page, visit.id);

    // Press P again to close pause, take in-game shot for reference
    await page.keyboard.press('p');
    await page.waitForTimeout(300);

    const errors = getErrors();
    if (errors.length > 0) {
      test.info().annotations.push({
        type: 'console-errors',
        description: errors.join('\n'),
      });
    }
  });
}

// ── 4. Navigation flows (click-through smoke tests) ─────────────────────────

test('sp-flow-vs-nav', { timeout: 45_000 }, async ({ page }) => {
  const getErrors = attachErrors(page);
  fs.mkdirSync(RAW_DIR, { recursive: true });

  // Title → menu
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await shot(page, 'sp-flow-title');

  await page.click('text=PRESS START');
  await page.waitForTimeout(400);
  await shot(page, 'sp-flow-menu');

  // Menu → VERSUS → char select
  await page.click('text=VERSUS');
  await page.waitForTimeout(400);
  await shot(page, 'sp-flow-charselect');

  // Pick P1 (press Enter on current cursor position)
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  // Switch to P2 slot and pick
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowRight'); // move cursor to avoid same guild
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  // Now readyToGo = true — press Enter to confirm
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await shot(page, 'sp-flow-stageselect');

  // Stage select → pick first stage
  await page.click('text=FIGHT →');
  await page.waitForTimeout(800);
  // Just verify we're past stage select (loading screen or game)
  await shot(page, 'sp-flow-game-loading');

  const errors = getErrors();
  if (errors.length > 0) {
    test.info().annotations.push({
      type: 'console-errors',
      description: errors.join('\n'),
    });
  }
});

test('sp-flow-championship-nav', { timeout: 30_000 }, async ({ page }) => {
  const getErrors = attachErrors(page);
  fs.mkdirSync(RAW_DIR, { recursive: true });

  await page.goto('/?screen=menu');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);

  await page.click('text=CHAMPIONSHIP');
  await page.waitForTimeout(400);
  await shot(page, 'sp-flow-charselect-champ');

  // Pick guild for championship
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await shot(page, 'sp-flow-champbracket');

  const errors = getErrors();
  if (errors.length > 0) {
    test.info().annotations.push({
      type: 'console-errors',
      description: errors.join('\n'),
    });
  }
});

test('sp-flow-battle-nav', { timeout: 30_000 }, async ({ page }) => {
  const getErrors = attachErrors(page);
  fs.mkdirSync(RAW_DIR, { recursive: true });

  await page.goto('/?screen=menu');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);

  await page.click('text=BATTLE');
  await page.waitForTimeout(400);
  await shot(page, 'sp-flow-charselect-batt');

  // Pick guild
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  // For battle mode, mode='batt' → charselect goes to battleconfig on READY
  await page.click('text=READY →');
  await page.waitForTimeout(400);
  await shot(page, 'sp-flow-battleconfig');

  const errors = getErrors();
  if (errors.length > 0) {
    test.info().annotations.push({
      type: 'console-errors',
      description: errors.join('\n'),
    });
  }
});
