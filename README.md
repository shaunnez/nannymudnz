# Nannymud

A browser-native, single-player 2.5D side-scrolling beat-'em-up in the style of Little Fighter 2. Pick one of 15 guild characters and fight through 6 waves of enemies on the Plains of Nan, ending in a 3-phase boss battle against the Bandit King.

## What it is

- **15 playable guilds** — Adventurer, Knight, Mage, Druid, Hunter, Monk, Viking, Prophet, Vampire, Cultist, Champion, Darkmage, Chef, Leper, Master
- **6 enemy waves** — Plains Bandits, Bandit Archers, Wolves, Bandit Brutes, and the Bandit King boss
- **Full 2.5D combat** — depth plane dodging, fake-Z elevation, LF2-style attack connection rules
- **Rich combat system** — combo chains, block/parry, knockdown/getup with i-frames, environmental pickups
- **Synth audio** — procedural music and SFX via Web Audio API, no external files needed
- **No backend** — runs entirely in the browser, settings persist via localStorage

## Controls

| Action | Default Key |
|---|---|
| Move left / right | ← → |
| Move up / down (depth) | ↑ ↓ |
| Jump | Space |
| Attack | J |
| Block / Defend | K |
| Grab / Throw | L |
| Pause | Esc |
| Run | Double-tap ← or → |
| Combo abilities | ↓↓J, →→J, ↓↑J, ←→J, ↓↑↓↑J |
| Guild RMB utility | K + J |

## Install & Run

```bash
npm install
npm run dev
```

Open your browser to the URL printed by Vite (usually `http://localhost:5173`).

## Build

```bash
npm run build
```

Output goes to `dist/`. Serve with any static file server — no server-side code required.

## Architecture

The codebase is split into three layers that never reach across each other:

- **`src/simulation/`** — Pure TypeScript simulation: combat resolution, ability execution, AI state machines, status effects, HP/MP accounting, wave progression. No DOM or canvas dependencies. Can be moved to a server runtime without changes.
- **`src/rendering/`** — Canvas 2D drawing: background, actors (via a swap-friendly `ActorRendererImpl` abstraction), HUD, particles. Reads simulation state; never writes it.
- **`src/input/`** — Translates browser KeyboardEvents into an `InputState` struct that the simulation consumes.
- **`src/audio/`** — Web Audio API synth sounds; entirely independent of simulation and rendering.

Swapping placeholder art for real sprites requires only implementing the `ActorRendererImpl` interface in `src/rendering/actorRenderer.ts` and pointing `GameRenderer` at the new implementation.

## Known Limitations

- Placeholder art only (colored rectangles with initials)
- No mobile / touch support
- No multiplayer (single-player only)
- No character leveling or progression between runs
- Boss phase 3 stomp AoE is simplified to melee range rather than a true shockwave
- Druid bear/wolf form ability slots share the same 5 combos (forms swap active ability set conceptually but use the same input grammar)
- Cultist sanity system drives the MP bar display; the self-damage-at-80%-sanity penalty is implemented but the visual feedback is text-only
