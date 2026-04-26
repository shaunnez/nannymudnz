# Nannymud

A browser-native 2.5D side-scrolling beat-'em-up in the style of Little Fighter 2. Pick one of 15 guild characters and fight through 6 waves of enemies on the Plains of Nan, ending in a 3-phase boss battle against the Bandit King — or challenge a friend to a 1v1 multiplayer match.

![Built with](https://img.shields.io/badge/Built%20with-Vite%20%7C%20React%20%7C%20Phaser%203%20%7C%20Colyseus-8b5cf6)

## Modes

- **Story** — single-player run: 6 waves of escalating enemies on a scrolling stage, boss fight at the end.
- **VS** — local 1v1 against an AI (pick both guilds).
- **Multiplayer 1v1** — server-authoritative online match over WebSocket. Host creates a room, friend joins via code. Best-of-three rounds with randomized respawn positions.

## Playable guilds (15)

Adventurer, Knight, Mage, Druid, Hunter, Monk, Viking, Prophet, Vampire, Cultist, Champion, Darkmage, Chef, Leper, Master — each with five combo abilities plus a guild-specific utility.

## Controls

| Action | Default key |
|---|---|
| Move left / right | ← → |
| Move up / down (depth plane) | ↑ ↓ |
| Jump | Space |
| Attack | J |
| Block / Defend | K |
| Grab / Throw | L |
| Pause | P |
| Fullscreen | F |
| Run | Double-tap ← or → |
| Combo abilities | ↓↓J, →→J, ↓↑J, ←→J, ↓↑↓↑J |
| Guild utility | K + J |

Keybinds are remappable in-game and persist via localStorage.

## Getting started

```bash
npm install
npm run dev   # starts Vite client (5173) and Colyseus MP server (2567)
```

Open `http://localhost:5173`. Single-player works offline; multiplayer requires the dev server on 2567 (automatically started by `npm run dev`).

To run only one side:

```bash
npm run dev:client   # client only (SP works; MP menus show, but Join will fail)
npm run dev:server   # Colyseus server only
```

## Building for production

```bash
npm run build      # client bundle → dist/
npm run preview    # serve the built dist/ locally
```

The client is a static bundle; host it on any static file server (Vercel, Netlify, S3+CloudFront, nginx). For multiplayer, the Colyseus server under `packages/server/` needs a Node host — configure the client via `VITE_COLYSEUS_URL` to point at it (e.g. `wss://mp.example.com`).

## Project structure

```
src/                 # Vite + React + Phaser client
packages/shared/     # pure-TS simulation, Colyseus schema, wire protocol
packages/server/     # Colyseus MatchRoom + Node entry point
public/sprites/      # per-guild animation strips (PixelLab generated)
scripts/             # sprite compositing + PixelLab batch tooling
docs/                # design specs and implementation plans
```

The simulation is deterministic and shared between client (single-player) and server (authoritative multiplayer). Rendering, input, and audio are separate layers that never mutate simulation state. See `CLAUDE.md` for the developer-facing architecture notes.

## Tech stack

- **Vite 5** — dev server and production bundler
- **React 18** — menus, screens, and pause overlay
- **Phaser 3** — game canvas, rendering, animation, scene management
- **TypeScript** — strict mode across client, shared, server
- **Colyseus** — authoritative room-based multiplayer (WebSocket + @colyseus/schema state sync)
- **Web Audio API** — procedural music and SFX (no audio files)
- **npm workspaces** — monorepo with `packages/shared` and `packages/server`
- **Vitest** — unit and determinism tests
- **ESLint (flat config)** — linting; enforces the "no browser APIs in simulation" boundary

## Testing

```bash
npm test                  # Vitest — sim + unit tests
npm run test:watch        # watch mode
npm run typecheck         # tsc --noEmit across all packages
npm run lint              # ESLint
npm run test:screens      # Playwright screen tour (38 screens, SP + MP)
npm run test:screens:headed  # same but headed — watch it navigate
```

The golden test at `packages/shared/src/simulation/__tests__/golden.test.ts` is the determinism gate for multiplayer. If you change simulation code and it fails, the change introduced non-determinism — fix the code rather than the snapshot.

### Screen tour

`npm run test:screens` kills stale dev servers, starts a fresh one, visits every screen with mocked state, and writes `screen-tour-report/REPORT.md` with embedded screenshots and a bug table.

**Deep-link any screen during development:**
```
http://localhost:5173/?screen=results&outcome=win&p1=adventurer&p2=knight
```
Params: `screen`, `mode`, `p1`, `p2`, `stage`, `outcome=win|lose`, `team=4v4|2v2v2v2|2v2|1v1`, `round`, `survScore`, `survWave`, `guild`.

To add or modify screen-tour visits, edit `tests/screen-tour/manifest.ts`. The spec files are `tests/screen-tour/sp.spec.ts` (SP + flows) and `tests/screen-tour/mp.spec.ts` (MP two-context).

## Art

Character sprites are generated with [PixelLab AI](https://pixellab.ai/) via `scripts/composite-pixellab-sprites.py` and live under `public/sprites/<guildId>/`. Backgrounds and VFX are procedurally drawn (Phaser Graphics + tweens). No external audio files — everything is synthesized in `src/audio/audioManager.ts`.

## Known limitations

- No mobile / touch input
- No character progression between runs
- Boss phase 3 stomp AoE is simplified to melee range (true shockwave is TODO)
- MP rematch flow doesn't yet carry score across the "return to lobby" step
- `@supabase/supabase-js` is a dependency but not currently wired up (reserved for future profiles/leaderboards)

## Contributing

If you're a human contributor: read `CLAUDE.md` — it's written for an LLM assistant but is the most accurate architecture map of the codebase. Plans for in-flight work are under `docs/superpowers/plans/`.

## License

TBD.
