/**
 * Multiplayer screen tour.
 *
 * Requires Colyseus running on :2567 (started by webServer via `npm run dev`).
 *
 * Key selectors discovered from source:
 * - Name input: input[placeholder="Enter your name…"] — uses onBlur to commit
 *   → must press Enter or Tab after fill() to trigger commitName()
 * - HOST ROOM button: text=HOST ROOM (disabled until nameReady)
 * - CREATE button: text=CREATE (inside CreateRoomModal via ModalShell)
 * - JOIN BY CODE button: text=JOIN BY CODE
 * - JOIN button: text=JOIN (inside JoinByCodeModal via ModalShell)
 * - Room code: rendered as "#XXXXXX" in lobby — use regex locator
 * - Join code input: 6 separate inputs, all maxlength=6 — paste into first one
 */

import { test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const RAW_DIR = 'screen-tour-report/raw';
const BASE = 'http://localhost:5173';

test.beforeAll(() => {
  fs.mkdirSync(RAW_DIR, { recursive: true });
});

function shot(page: Page, id: string) {
  return page.screenshot({ path: path.join(RAW_DIR, `${id}.png`), fullPage: false });
}

function attachErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`[page-error] ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
  });
  return () => errors;
}

async function fillName(page: Page, name: string) {
  // The name input uses onBlur/onKeyDown(Enter) to commit — fill + Enter
  const input = page.locator('input[placeholder="Enter your name…"]');
  await input.fill(name);
  await input.press('Enter');     // triggers commitName() → nameReady=true
  await page.waitForTimeout(200); // let React re-render
}

// ── Hub / modals (single context) ───────────────────────────────────────────

test('mp-hub', { timeout: 20_000 }, async ({ page }) => {
  const getErrors = attachErrors(page);
  await page.goto(`${BASE}/?screen=mp_hub`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await shot(page, 'mp-hub');
  const errors = getErrors();
  if (errors.length) test.info().annotations.push({ type: 'console-errors', description: errors.join('\n') });
});

test('mp-create-modal', { timeout: 30_000 }, async ({ page }) => {
  const getErrors = attachErrors(page);
  await page.goto(`${BASE}/?screen=mp_hub`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);

  await fillName(page, 'TestHost');
  await page.click('text=HOST ROOM');
  await page.waitForTimeout(600);
  await shot(page, 'mp-create-modal');

  const errors = getErrors();
  if (errors.length) test.info().annotations.push({ type: 'console-errors', description: errors.join('\n') });
});

test('mp-join-modal', { timeout: 30_000 }, async ({ page }) => {
  const getErrors = attachErrors(page);
  await page.goto(`${BASE}/?screen=mp_hub`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);

  await fillName(page, 'TestJoiner');
  await page.click('text=JOIN BY CODE');
  await page.waitForTimeout(600);
  await shot(page, 'mp-join-modal');

  const errors = getErrors();
  if (errors.length) test.info().annotations.push({ type: 'console-errors', description: errors.join('\n') });
});

// ── Full Versus 1v1 flow ─────────────────────────────────────────────────────

async function setupTwoContexts(browser: Browser, hostName: string, joinerName: string) {
  const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const joinerCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const hostPage = await hostCtx.newPage();
  const joinerPage = await joinerCtx.newPage();

  // Host: navigate to hub and create room
  await hostPage.goto(`${BASE}/?screen=mp_hub`);
  await hostPage.waitForLoadState('networkidle');
  await hostPage.waitForTimeout(400);
  await fillName(hostPage, hostName);
  await hostPage.click('text=HOST ROOM');
  await hostPage.waitForTimeout(500);
  // Click the primary CREATE button (use role to avoid matching "Create a private or public room" subtitle)
  await hostPage.getByRole('button', { name: 'CREATE', exact: true }).click();
  // Wait for lobby — room code appears as "#XXXXXX"
  await hostPage.waitForSelector('text=/^#[A-Z0-9]{6}$/', { timeout: 15_000 });

  // Extract room code
  const codeText = await hostPage.locator('text=/^#[A-Z0-9]{6}$/').first().textContent();
  const roomCode = (codeText ?? '').replace('#', '').trim().slice(0, 6);

  return { hostPage, joinerPage, roomCode, hostCtx, joinerCtx };
}

async function joinerJoin(joinerPage: Page, joinerName: string, roomCode: string) {
  await joinerPage.goto(`${BASE}/?screen=mp_hub`);
  await joinerPage.waitForLoadState('networkidle');
  await joinerPage.waitForTimeout(400);
  await fillName(joinerPage, joinerName);
  await joinerPage.click('text=JOIN BY CODE');
  await joinerPage.waitForTimeout(500);
  // Paste code into the first cell input (handleInput accepts full paste)
  const firstCell = joinerPage.locator('input[maxlength="6"]').first();
  await firstCell.fill(roomCode);
  await joinerPage.waitForTimeout(300);
  // Click the primary JOIN button (use role to avoid ambiguity)
  await joinerPage.getByRole('button', { name: 'JOIN', exact: true }).click();
  // Wait until in lobby
  await joinerPage.waitForSelector('text=/^#[A-Z0-9]{6}$/', { timeout: 15_000 }).catch(() => {});
}

test('mp-versus-flow', { timeout: 120_000 }, async ({ browser }) => {
  let hostPage: Page | undefined;
  let joinerPage: Page | undefined;
  let hostCtx: Awaited<ReturnType<Browser['newContext']>> | undefined;
  let joinerCtx: Awaited<ReturnType<Browser['newContext']>> | undefined;

  try {
    const setup = await setupTwoContexts(browser, 'HostPlayer', 'JoinerPlayer');
    hostPage = setup.hostPage;
    joinerPage = setup.joinerPage;
    hostCtx = setup.hostCtx;
    joinerCtx = setup.joinerCtx;
    const roomCode = setup.roomCode;

    await shot(hostPage, 'mp-versus-lobby');

    if (!roomCode) {
      test.info().annotations.push({ type: 'console-errors', description: 'No room code extracted — joiner skipped' });
      return;
    }

    await joinerJoin(joinerPage, 'JoinerPlayer', roomCode);
    await shot(hostPage, 'mp-versus-lobby');
    await shot(joinerPage, 'mp-versus-lobby-joiner');

    // Click READY UP for both (keyboard shortcut unreliable cross-context)
    await hostPage.locator('button', { hasText: /READY UP/ }).click();
    await hostPage.waitForTimeout(400);
    await joinerPage.locator('button', { hasText: /READY UP/ }).click();
    // Wait until all ready indicator appears for host
    await hostPage.waitForSelector('text=ALL PLAYERS READY', { timeout: 10_000 });
    await hostPage.waitForTimeout(300);

    // Host launches via LAUNCH BATTLE button
    await hostPage.locator('button', { hasText: /LAUNCH BATTLE/ }).click();
    await hostPage.waitForTimeout(1_000);

    await shot(hostPage, 'mp-versus-charselect');
    await shot(joinerPage, 'mp-versus-charselect-joiner');

    // Pick a guild (first Enter sets localPick), then lock (second Enter sends lock_guild)
    await hostPage.keyboard.press('Enter');     // host: sets localPick
    await hostPage.waitForTimeout(300);
    await hostPage.keyboard.press('Enter');     // host: locks
    await hostPage.waitForTimeout(400);

    await joinerPage.keyboard.press('ArrowRight'); // joiner: move to a different guild
    await joinerPage.waitForTimeout(200);
    await joinerPage.keyboard.press('Enter');   // joiner: sets localPick
    await joinerPage.waitForTimeout(300);
    await joinerPage.keyboard.press('Enter');   // joiner: locks
    await joinerPage.waitForTimeout(1_000);     // wait for server to advance to stage_select

    await shot(hostPage, 'mp-versus-stageselect');

    // Host picks first stage (Assembly Hall — always unlocked)
    await hostPage.keyboard.press('Enter'); // commit current stage (Assembly Hall is default)
    await hostPage.waitForTimeout(1_000);
    await shot(hostPage, 'mp-versus-loading');
    await shot(joinerPage, 'mp-versus-loading-joiner');

    // Wait for game canvas (soft — MP load can be slow, just capture what's visible)
    await hostPage.waitForSelector('canvas', { state: 'attached', timeout: 30_000 }).catch(() => {});
    await hostPage.waitForTimeout(1_500);

    await shot(hostPage, 'mp-versus-battle');
    await shot(joinerPage, 'mp-versus-battle-joiner');

    // Host quits (press P to pause then click quit)
    await hostPage.keyboard.press('p');
    await hostPage.waitForTimeout(500);
    await shot(hostPage, 'mp-versus-pause');
    const quitBtn = hostPage.locator('text=QUIT').or(hostPage.locator('text=MENU')).first();
    await quitBtn.click().catch(() => hostPage!.keyboard.press('Escape'));
    await hostPage.waitForTimeout(1_000);
    await shot(hostPage, 'mp-versus-results');

  } finally {
    await hostCtx?.close().catch(() => {});
    await joinerCtx?.close().catch(() => {});
  }
});

// ── Multiplayer Battle flow ───────────────────────────────────────────────────

test('mp-battle-flow', { timeout: 120_000 }, async ({ browser }) => {
  let hostCtx: Awaited<ReturnType<Browser['newContext']>> | undefined;
  let joinerCtx: Awaited<ReturnType<Browser['newContext']>> | undefined;

  try {
    const hostCtxNew = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const joinerCtxNew = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    hostCtx = hostCtxNew;
    joinerCtx = joinerCtxNew;
    const hostPage = await hostCtxNew.newPage();
    const joinerPage = await joinerCtxNew.newPage();

    // Host creates a Battle room
    await hostPage.goto(`${BASE}/?screen=mp_hub`);
    await hostPage.waitForLoadState('networkidle');
    await hostPage.waitForTimeout(400);
    await fillName(hostPage, 'BattleHost');
    await hostPage.click('text=HOST ROOM');
    await hostPage.waitForTimeout(500);

    // Switch to Battle mode before creating
    await hostPage.click('text=BATTLE · UP TO 8');
    await hostPage.waitForTimeout(200);
    await hostPage.getByRole('button', { name: 'CREATE', exact: true }).click();
    await hostPage.waitForSelector('text=/^#[A-Z0-9]{6}$/', { timeout: 15_000 });

    const codeText = await hostPage.locator('text=/^#[A-Z0-9]{6}$/').first().textContent();
    const roomCode = (codeText ?? '').replace('#', '').trim().slice(0, 6);

    await shot(hostPage, 'mp-battle-config');

    if (roomCode) {
      await joinerJoin(joinerPage, 'BattleJoiner', roomCode);
      await shot(joinerPage, 'mp-battle-config-joiner');
      // Screenshot both views of the battle config — that's the target for this test
      await hostPage.waitForTimeout(1_000);
      await shot(hostPage, 'mp-battle-config-host');
    }
  } finally {
    await hostCtx?.close().catch(() => {});
    await joinerCtx?.close().catch(() => {});
  }
});
