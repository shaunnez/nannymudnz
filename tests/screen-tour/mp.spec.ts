/**
 * Multiplayer screen tour.
 *
 * Each test requires the Colyseus server to be running (started by webServer
 * in playwright.config.ts via `npm run dev`).
 *
 * Two-context flow:
 *   - Host: creates a room
 *   - Joiner: joins by room code
 *
 * Screenshots go to screen-tour-report/raw/mp-*.png.
 * Console errors are captured as annotations for the markdown reporter.
 */

import { test, Browser } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const RAW_DIR = 'screen-tour-report/raw';
const BASE = 'http://localhost:5173';

test.beforeAll(() => {
  fs.mkdirSync(RAW_DIR, { recursive: true });
});

function shot(page: import('@playwright/test').Page, id: string) {
  return page.screenshot({
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

// ---------------------------------------------------------------------------
// Hub screens (single context — no real Colyseus room needed for initial view)
// ---------------------------------------------------------------------------

test('mp-hub', { timeout: 20_000 }, async ({ page }) => {
  const getErrors = attachErrors(page);
  await page.goto(`${BASE}/?screen=mp_hub`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await shot(page, 'mp-hub');
  const errors = getErrors();
  if (errors.length) test.info().annotations.push({ type: 'console-errors', description: errors.join('\n') });
});

test('mp-create-modal', { timeout: 20_000 }, async ({ page }) => {
  const getErrors = attachErrors(page);
  await page.goto(`${BASE}/?screen=mp_hub`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);

  // Fill player name and open create modal
  const nameInput = page.locator('input[placeholder*="name"], input[type="text"]').first();
  await nameInput.fill('TestHost');
  await page.waitForTimeout(200);
  await page.click('text=HOST ROOM');
  await page.waitForTimeout(400);
  await shot(page, 'mp-create-modal');

  const errors = getErrors();
  if (errors.length) test.info().annotations.push({ type: 'console-errors', description: errors.join('\n') });
});

test('mp-join-modal', { timeout: 20_000 }, async ({ page }) => {
  const getErrors = attachErrors(page);
  await page.goto(`${BASE}/?screen=mp_hub`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);

  const nameInput = page.locator('input[placeholder*="name"], input[type="text"]').first();
  await nameInput.fill('TestJoiner');
  await page.waitForTimeout(200);
  await page.click('text=JOIN BY CODE');
  await page.waitForTimeout(400);
  await shot(page, 'mp-join-modal');

  const errors = getErrors();
  if (errors.length) test.info().annotations.push({ type: 'console-errors', description: errors.join('\n') });
});

// ---------------------------------------------------------------------------
// Full Versus 1v1 flow — two real browser contexts against live Colyseus
// ---------------------------------------------------------------------------

async function createVersusRoom(browser: Browser): Promise<{
  hostPage: import('@playwright/test').Page;
  joinerPage: import('@playwright/test').Page;
  roomCode: string;
}> {
  const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const joinerCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const hostPage = await hostCtx.newPage();
  const joinerPage = await joinerCtx.newPage();

  // Host: navigate to hub and create a Versus room
  await hostPage.goto(`${BASE}/?screen=mp_hub`);
  await hostPage.waitForLoadState('networkidle');
  await hostPage.waitForTimeout(400);

  const hostNameInput = hostPage.locator('input[placeholder*="name"], input[type="text"]').first();
  await hostNameInput.fill('HostPlayer');
  await hostPage.waitForTimeout(200);
  await hostPage.click('text=HOST ROOM');
  await hostPage.waitForTimeout(500);

  // In the create modal, pick Versus mode if present and click Create
  // (look for radio/select for game mode, default is 'versus')
  const createBtn = hostPage.locator('button', { hasText: /create|start/i }).last();
  await createBtn.click();
  await hostPage.waitForTimeout(1_000);

  // Extract room code from badge
  const codeEl = hostPage.locator('[class*="code"], [class*="badge"], [data-roomcode]').first();
  const roomCode = await codeEl.textContent({ timeout: 10_000 }).catch(() => '');
  const code = (roomCode ?? '').replace(/\s/g, '').slice(0, 6);

  return { hostPage, joinerPage, roomCode: code };
}

test('mp-versus-flow', { timeout: 120_000 }, async ({ browser }) => {
  let hostPage: import('@playwright/test').Page | undefined;
  let joinerPage: import('@playwright/test').Page | undefined;

  try {
    const setup = await createVersusRoom(browser);
    hostPage = setup.hostPage;
    joinerPage = setup.joinerPage;
    const roomCode = setup.roomCode;

    // Screenshot: host in lobby
    await shot(hostPage, 'mp-versus-lobby');

    if (!roomCode) {
      test.info().annotations.push({
        type: 'console-errors',
        description: 'Could not extract room code — skipping joiner flow',
      });
      return;
    }

    // Joiner: navigate to hub and join by code
    await joinerPage.goto(`${BASE}/?screen=mp_hub`);
    await joinerPage.waitForLoadState('networkidle');
    await joinerPage.waitForTimeout(400);

    const joinerNameInput = joinerPage.locator('input[placeholder*="name"], input[type="text"]').first();
    await joinerNameInput.fill('JoinerPlayer');
    await joinerPage.waitForTimeout(200);
    await joinerPage.click('text=JOIN BY CODE');
    await joinerPage.waitForTimeout(400);

    // Enter room code
    const codeInput = joinerPage.locator('input[placeholder*="code"], input[maxlength]').first();
    await codeInput.fill(roomCode);
    await joinerPage.waitForTimeout(200);
    const joinBtn = joinerPage.locator('button', { hasText: /join/i }).last();
    await joinBtn.click();
    await joinerPage.waitForTimeout(1_500);

    // Both should now be in lobby
    await shot(hostPage, 'mp-versus-lobby');
    await shot(joinerPage, 'mp-versus-lobby-joiner');

    // Mark both ready and advance to char select
    // Host: click READY or press Enter
    await hostPage.keyboard.press('Enter');
    await hostPage.waitForTimeout(400);
    await joinerPage.keyboard.press('Enter');
    await joinerPage.waitForTimeout(1_000);

    // Char select screen
    await shot(hostPage, 'mp-versus-charselect');
    await shot(joinerPage, 'mp-versus-charselect-joiner');

    // Both pick a guild and lock in
    await hostPage.keyboard.press('Enter');   // pick guild
    await hostPage.waitForTimeout(200);
    await joinerPage.keyboard.press('ArrowRight');
    await joinerPage.keyboard.press('Enter');
    await joinerPage.waitForTimeout(200);

    // Lock guilds (press Enter again when locked = ready)
    await hostPage.keyboard.press('Enter');
    await hostPage.waitForTimeout(400);
    await joinerPage.keyboard.press('Enter');
    await joinerPage.waitForTimeout(1_000);

    // Stage select (host only picks stage)
    await shot(hostPage, 'mp-versus-stageselect');
    await hostPage.click('text=FIGHT →').catch(() => hostPage!.keyboard.press('Enter'));
    await hostPage.waitForTimeout(1_000);

    // Loading screen
    await shot(hostPage, 'mp-versus-loading');
    await shot(joinerPage, 'mp-versus-loading-joiner');

    // Wait for game canvas
    await Promise.all([
      hostPage.waitForSelector('canvas', { timeout: 60_000 }),
      joinerPage.waitForSelector('canvas', { timeout: 60_000 }),
    ]);
    await hostPage.waitForTimeout(2_000);

    await shot(hostPage, 'mp-versus-battle');
    await shot(joinerPage, 'mp-versus-battle-joiner');

    // Host quits to trigger results
    await hostPage.keyboard.press('p');   // pause
    await hostPage.waitForTimeout(400);
    const quitBtn = hostPage.locator('button, [role="button"]', { hasText: /quit|menu/i }).first();
    await quitBtn.click().catch(() => hostPage!.keyboard.press('Escape'));
    await hostPage.waitForTimeout(1_000);

    await shot(hostPage, 'mp-versus-results');

  } finally {
    await hostPage?.context().close().catch(() => {});
    await joinerPage?.context().close().catch(() => {});
  }
});

// ---------------------------------------------------------------------------
// Multiplayer Battle flow — host + joiner, 4v4 via battle_config
// ---------------------------------------------------------------------------

test('mp-battle-flow', { timeout: 120_000 }, async ({ browser }) => {
  let hostPage: import('@playwright/test').Page | undefined;
  let joinerPage: import('@playwright/test').Page | undefined;

  try {
    const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const joinerCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    hostPage = await hostCtx.newPage();
    joinerPage = await joinerCtx.newPage();

    // Host: create a Battle room
    await hostPage.goto(`${BASE}/?screen=mp_hub`);
    await hostPage.waitForLoadState('networkidle');
    await hostPage.waitForTimeout(400);

    const hostNameInput = hostPage.locator('input[placeholder*="name"], input[type="text"]').first();
    await hostNameInput.fill('BattleHost');
    await hostPage.waitForTimeout(200);
    await hostPage.click('text=HOST ROOM');
    await hostPage.waitForTimeout(500);

    // Switch to Battle game mode in the modal
    const battleOption = hostPage.locator('label, button, input[type="radio"]', { hasText: /battle/i }).first();
    await battleOption.click().catch(() => {});
    await hostPage.waitForTimeout(200);

    const createBtn = hostPage.locator('button', { hasText: /create|start/i }).last();
    await createBtn.click();
    await hostPage.waitForTimeout(1_000);

    // Extract room code
    const codeEl = hostPage.locator('[class*="code"], [class*="badge"], [data-roomcode]').first();
    const roomCode = ((await codeEl.textContent({ timeout: 10_000 }).catch(() => '')) ?? '')
      .replace(/\s/g, '')
      .slice(0, 6);

    // Screenshot battle config screen (host sees it first)
    await shot(hostPage, 'mp-battle-config');

    if (!roomCode) {
      test.info().annotations.push({
        type: 'console-errors',
        description: 'Could not extract room code — skipping joiner battle flow',
      });
      return;
    }

    // Joiner joins
    await joinerPage.goto(`${BASE}/?screen=mp_hub`);
    await joinerPage.waitForLoadState('networkidle');
    await joinerPage.waitForTimeout(400);

    const joinerNameInput = joinerPage.locator('input[placeholder*="name"], input[type="text"]').first();
    await joinerNameInput.fill('BattleJoiner');
    await joinerPage.waitForTimeout(200);
    await joinerPage.click('text=JOIN BY CODE');
    await joinerPage.waitForTimeout(400);

    const codeInput = joinerPage.locator('input[placeholder*="code"], input[maxlength]').first();
    await codeInput.fill(roomCode);
    await joinerPage.waitForTimeout(200);
    const joinBtn = joinerPage.locator('button', { hasText: /join/i }).last();
    await joinBtn.click();
    await joinerPage.waitForTimeout(1_500);

    await shot(joinerPage, 'mp-battle-config-joiner');

    // Both lock slots and launch
    await hostPage.keyboard.press('Enter');
    await hostPage.waitForTimeout(400);
    await joinerPage.keyboard.press('Enter');
    await joinerPage.waitForTimeout(1_000);

    await shot(hostPage, 'mp-battle-stageselect');
    await hostPage.click('text=FIGHT →').catch(() => hostPage!.keyboard.press('Enter'));
    await hostPage.waitForTimeout(1_000);

    await shot(hostPage, 'mp-battle-loading');

    // Wait for canvas
    await Promise.all([
      hostPage.waitForSelector('canvas', { timeout: 60_000 }),
      joinerPage.waitForSelector('canvas', { timeout: 60_000 }),
    ]);
    await hostPage.waitForTimeout(2_000);

    await shot(hostPage, 'mp-battle-game');
    await shot(joinerPage, 'mp-battle-game-joiner');

    // Quit to results
    await hostPage.keyboard.press('p');
    await hostPage.waitForTimeout(400);
    const quitBtn = hostPage.locator('button, [role="button"]', { hasText: /quit|menu/i }).first();
    await quitBtn.click().catch(() => hostPage!.keyboard.press('Escape'));
    await hostPage.waitForTimeout(1_000);

    await shot(hostPage, 'mp-battle-results');

  } finally {
    await hostPage?.context().close().catch(() => {});
    await joinerPage?.context().close().catch(() => {});
  }
});
