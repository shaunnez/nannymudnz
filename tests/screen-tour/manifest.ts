export interface ScreenVisit {
  id: string;
  category: 'sp' | 'mp' | 'overlay';
  description: string;
  /** Direct URL to navigate to (for deep-link tests). */
  url?: string;
  /** If true, waits for Phaser canvas after navigation. */
  requiresGame?: true;
  /** Custom per-test timeout in ms (default: 30 000). */
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Single-player: pure React screens (fast deep-links)
// ---------------------------------------------------------------------------

export const SP_VISITS: ScreenVisit[] = [
  // ── Navigation / menus ──────────────────────────────────────────────────
  {
    id: 'sp-title',
    category: 'sp',
    description: 'Title / press-start screen',
    url: '/?screen=title',
  },
  {
    id: 'sp-menu',
    category: 'sp',
    description: 'Main menu with all game-mode options',
    url: '/?screen=menu',
  },
  {
    id: 'sp-charselect-vs',
    category: 'sp',
    description: 'Character select — VS 1v1 mode',
    url: '/?screen=charselect&mode=vs',
  },
  {
    id: 'sp-charselect-stage',
    category: 'sp',
    description: 'Character select — Stage mode (single pick)',
    url: '/?screen=charselect&mode=stage',
  },
  {
    id: 'sp-charselect-surv',
    category: 'sp',
    description: 'Character select — Survival mode (single pick)',
    url: '/?screen=charselect&mode=surv',
  },
  {
    id: 'sp-charselect-batt',
    category: 'sp',
    description: 'Character select — Battle 4v4 mode (human guild pick)',
    url: '/?screen=charselect&mode=batt',
  },
  {
    id: 'sp-charselect-champ',
    category: 'sp',
    description: 'Character select — Championship mode',
    url: '/?screen=charselect&mode=champ',
  },
  {
    id: 'sp-battleconfig',
    category: 'sp',
    description: 'Battle config — 8-slot team assignment',
    url: '/?screen=battleconfig&p1=adventurer',
  },
  {
    id: 'sp-battleconfig-2v2v2v2',
    category: 'sp',
    description: 'Battle config — 2v2v2v2 pre-loaded',
    url: '/?screen=battleconfig&p1=adventurer&team=2v2v2v2',
  },
  {
    id: 'sp-stageselect',
    category: 'sp',
    description: 'Stage selection screen',
    url: '/?screen=stage',
  },
  {
    id: 'sp-settings',
    category: 'sp',
    description: 'Settings screen (difficulty, HUD)',
    url: '/?screen=settings',
  },
  {
    id: 'sp-moves',
    category: 'sp',
    description: 'Move list — Adventurer guild',
    url: '/?screen=moves&guild=adventurer',
  },
  {
    id: 'sp-moves-viking',
    category: 'sp',
    description: 'Move list — Viking guild',
    url: '/?screen=moves&guild=viking',
  },
  {
    id: 'sp-dossier',
    category: 'sp',
    description: 'Guild dossier — Adventurer',
    url: '/?screen=guild_dossier&guild=adventurer',
  },

  // ── Results screens ──────────────────────────────────────────────────────
  {
    id: 'sp-results-win',
    category: 'sp',
    description: 'VS results — P1 (Adventurer) wins',
    url: '/?screen=results&outcome=win&p1=adventurer&p2=knight',
  },
  {
    id: 'sp-results-lose',
    category: 'sp',
    description: 'VS results — P1 (Adventurer) loses',
    url: '/?screen=results&outcome=lose&p1=adventurer&p2=knight',
  },
  {
    id: 'sp-battresults-4v4-win',
    category: 'sp',
    description: 'Battle results — 4v4, player wins',
    url: '/?screen=battresults&team=4v4&outcome=win',
  },
  {
    id: 'sp-battresults-4v4-lose',
    category: 'sp',
    description: 'Battle results — 4v4, player loses',
    url: '/?screen=battresults&team=4v4&outcome=lose',
  },
  {
    id: 'sp-battresults-2v2v2v2-win',
    category: 'sp',
    description: 'Battle results — 2v2v2v2, player wins',
    url: '/?screen=battresults&team=2v2v2v2&outcome=win',
  },
  {
    id: 'sp-survresults',
    category: 'sp',
    description: 'Survival results — wave 7, score 45 600',
    url: '/?screen=survresults&p1=adventurer&survScore=45600&survWave=7',
  },
  {
    id: 'sp-champbracket',
    category: 'sp',
    description: 'Championship bracket — round 1 (QF)',
    url: '/?screen=champbracket',
  },
  {
    id: 'sp-champtransition-win',
    category: 'sp',
    description: 'Championship transition — QF won, advancing to SF',
    url: '/?screen=champtransition&round=1&outcome=win',
  },
  {
    id: 'sp-champtransition-lose',
    category: 'sp',
    description: 'Championship transition — QF lost, eliminated',
    url: '/?screen=champtransition&round=0&outcome=lose',
  },
  {
    id: 'sp-champresults-win',
    category: 'sp',
    description: 'Championship results — champion',
    url: '/?screen=champresults&outcome=win',
  },
  {
    id: 'sp-champresults-lose',
    category: 'sp',
    description: 'Championship results — eliminated',
    url: '/?screen=champresults&outcome=lose',
  },
];

// ---------------------------------------------------------------------------
// In-game screens (require Phaser boot — slower, longer timeouts)
// ---------------------------------------------------------------------------

export const GAME_VISITS: ScreenVisit[] = [
  {
    id: 'sp-game-vs',
    category: 'sp',
    description: 'In-game — VS 1v1 (Adventurer vs Knight, Assembly Hall)',
    url: '/?screen=game&mode=vs&p1=adventurer&p2=knight&stage=assembly',
    requiresGame: true,
    timeout: 90_000,
  },
  {
    id: 'sp-game-stage',
    category: 'sp',
    description: 'In-game — Stage mode (Adventurer, Assembly Hall)',
    url: '/?screen=game&mode=stage&p1=adventurer&stage=assembly',
    requiresGame: true,
    timeout: 90_000,
  },
  {
    id: 'sp-game-surv',
    category: 'sp',
    description: 'In-game — Survival (Adventurer)',
    url: '/?screen=game&mode=surv&p1=adventurer',
    requiresGame: true,
    timeout: 90_000,
  },
  {
    id: 'sp-game-batt-4v4',
    category: 'sp',
    description: 'In-game — Battle 4v4 (Adventurer leads Team A)',
    url: '/?screen=game&mode=batt&team=4v4&p1=adventurer&stage=assembly',
    requiresGame: true,
    timeout: 90_000,
  },
];

// ---------------------------------------------------------------------------
// Overlay tests (require game to be running then interact)
// ---------------------------------------------------------------------------

export const OVERLAY_VISITS: ScreenVisit[] = [
  {
    id: 'overlay-pause',
    category: 'overlay',
    description: 'Pause overlay — VS game, press P',
    url: '/?screen=game&mode=vs&p1=adventurer&p2=knight&stage=assembly',
    requiresGame: true,
    timeout: 90_000,
  },
];

// ---------------------------------------------------------------------------
// Multiplayer screens (driven by mp.spec.ts with two contexts)
// ---------------------------------------------------------------------------

export const MP_VISITS: ScreenVisit[] = [
  {
    id: 'mp-hub',
    category: 'mp',
    description: 'MP Hub — room list + create/join buttons',
    url: '/?screen=mp_hub',
  },
  {
    id: 'mp-create-modal',
    category: 'mp',
    description: 'Create room modal — game mode picker',
  },
  {
    id: 'mp-join-modal',
    category: 'mp',
    description: 'Join by code modal',
  },
  {
    id: 'mp-versus-lobby',
    category: 'mp',
    description: 'MP Versus lobby — host + 1 joiner',
    timeout: 30_000,
  },
  {
    id: 'mp-versus-charselect',
    category: 'mp',
    description: 'MP Versus char select — both players',
    timeout: 30_000,
  },
  {
    id: 'mp-versus-stageselect',
    category: 'mp',
    description: 'MP Versus stage select (host)',
    timeout: 30_000,
  },
  {
    id: 'mp-versus-loading',
    category: 'mp',
    description: 'MP Versus loading screen',
    timeout: 30_000,
  },
  {
    id: 'mp-versus-battle',
    category: 'mp',
    description: 'MP Versus in-game',
    requiresGame: true,
    timeout: 90_000,
  },
  {
    id: 'mp-versus-results',
    category: 'mp',
    description: 'MP Versus results after one player quits',
    timeout: 30_000,
  },
  {
    id: 'mp-battle-config',
    category: 'mp',
    description: 'MP Battle config screen (8 slots)',
    timeout: 30_000,
  },
  {
    id: 'mp-battle-game',
    category: 'mp',
    description: 'MP Battle in-game (4v4)',
    requiresGame: true,
    timeout: 90_000,
  },
  {
    id: 'mp-battle-results',
    category: 'mp',
    description: 'MP Battle results',
    timeout: 30_000,
  },
];

export const ALL_VISITS: ScreenVisit[] = [
  ...SP_VISITS,
  ...GAME_VISITS,
  ...OVERLAY_VISITS,
  ...MP_VISITS,
];
