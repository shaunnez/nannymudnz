# Runbook — Generate Guild Sprite Sheets via PixelLab MCP

**Purpose:** Step-by-step procedure to generate a new guild's 15-animation sprite sheet. Follow this whenever you need to add (or regenerate) sprites for any of the 15 guilds defined in `lore-old/guilds.json`.

**Prerequisites:**
- Active PixelLab subscription (MCP tools return credit errors otherwise).
- `pixellab` MCP server connected to this Claude session.
- Access to `lore-old/guilds.json` and `oneshot.md` §5 for guild flavor text.

## Inputs per run

- `guildId` (e.g. `leper`) — matches the id in `lore-old/guilds.json`.
- Guild entry from `lore-old/guilds.json` — supplies `colorPalette`, `archetype`, `fantasy`, `loreSummary`.
- Guild entry from `oneshot.md` §5.x — supplies the 5 ability names and effects.

## Output layout (contract)

```
public/sprites/<guildId>/
├── idle.png, walk.png, run.png, jump.png
├── attack_1.png, attack_2.png, attack_3.png
├── ability_1.png, ability_2.png, ability_3.png, ability_4.png, ability_5.png
├── block.png
├── hurt.png
├── death.png
└── metadata.json
```

Each PNG is a horizontal strip of per-frame images. Target frame size is 64×64 but **PixelLab pads to 68×68 in practice** — `SpriteActorRenderer` reads `frameSize` from metadata at runtime, so this is fine; just record what PixelLab actually produced. `metadata.json` schema is documented in `docs/superpowers/specs/2026-04-20-pixellab-guild-sprites-design.md` §Sprite contract.

## Step 1 — Base character prompt

Fill this template using the guild's data:

> **"{ARCHETYPE-DESCRIPTOR} {ROLE}, {FANTASY-CUES}, {PALETTE-CUES}, pixel art, side-view, plain background, 64x64"**

Examples:

| Guild | Filled prompt |
|---|---|
| leper | "diseased plague-bearer bruiser, ragged hooded robe, torn bandages, hunched posture, necrotic green skin patches, no facial features visible, muted olive/brown palette (#6B7F4F #8B5A2B #3F4F2F), pixel art, side-view, plain background, 64x64" |
| knight | "armored frontline knight, plate armor with tabard, sword and kite shield, stoic posture, gold trim on deep blue and white palette (#C9A961 #2B4C6F #F5F5F5), pixel art, side-view, plain background, 64x64" |
| mage | "robed arcane scholar, tall hood, staff, glowing runes, deep violet robes on pale background (#4A2E75 #8E6DC8 #E8D5FF), pixel art, side-view, plain background, 64x64" |

## Step 2 — Generate base character

Invoke the MCP tool:

```
mcp__pixellab__create_character
  description: <the filled prompt from Step 1>
  size: 64
  view: "side"
```

Poll until the job completes. Download the returned PNG and display it in-conversation.

**Retry gate #1:** if the result is off-style, re-run with an adjusted prompt **before** moving on. Iterating here saves 15× the credits.

Store the character reference returned by the tool for use in Step 3.

## Step 3 — Generate 15 animations in parallel

Using the base character reference from Step 2, dispatch all 15 `mcp__pixellab__animate_character` calls in a single parallel batch.

### Per-animation action-prompt table (universal + per-guild flavor)

Replace `{flavor}` placeholders using `oneshot.md` §5.x for the target guild.

| AnimationId | Action prompt |
|---|---|
| `idle` | "standing still, slight sway/breathing, 4 frames, loop" |
| `walk` | "walking right, 6 frames, loop" |
| `run` | "running right, 6 frames, loop" |
| `jump` | "jump arc: crouch, launch, peak, land, 4 frames, non-loop" |
| `attack_1` | "basic attack: {flavor: primary weapon} swing, 5 frames, non-loop" |
| `attack_2` | "basic attack 2: {flavor: alternate swing or follow-up}, 5 frames, non-loop" |
| `attack_3` | "basic attack 3 (combo finisher): {flavor: heavy strike}, 6 frames, non-loop" |
| `ability_1` | "{flavor: slot-1 ability + visual cue from oneshot.md §5.x}, 5 frames, non-loop" |
| `ability_2` | "{flavor: slot-2 ability}, 5 frames, non-loop" |
| `ability_3` | "{flavor: slot-3 ability}, 5 frames, non-loop" |
| `ability_4` | "{flavor: slot-4 ability}, 5 frames, non-loop" |
| `ability_5` | "{flavor: slot-5 ability — often a channel / ultimate}, 6 frames, may loop if channel" |
| `block` | "defensive stance, 2 frames, loop" |
| `hurt` | "recoil back, head tilted, 3 frames, non-loop" |
| `death` | "stagger, collapse forward, 6 frames, non-loop" |

### Leper worked example (§5.14 of `oneshot.md`)

| AnimationId | Action prompt |
|---|---|
| `attack_1` | "overhead claw swipe, 5 frames, non-loop" |
| `attack_2` | "backhand slash, 5 frames, non-loop" |
| `attack_3` | "heavy double-fisted smash, 6 frames, non-loop" |
| `ability_1` | "plague vomit: hunches forward, cone of green vomit from mouth, 5 frames, non-loop" |
| `ability_2` | "diseased claw swipe, overhead, 5 frames, non-loop" |
| `ability_3` | "necrotic embrace: arms out, grab/bear-hug forward, 5 frames, non-loop" |
| `ability_4` | "two-handed hex curse gesture, ranged pointing, 5 frames, non-loop" |
| `ability_5` | "rotting tide channel: arms raised, swaying, 6 frames, loop" |

### Known hard cases per guild (character-only scope)

These abilities do **not** generate their full effect in the base-character sheet — the character animation is only the *caster's pose*. The effect entity (pet, summon, alt-form) is a separate actor kind and out of scope for the guild's base sheet:

| Guild | Skip-the-entity note |
|---|---|
| druid (§5.4.1) | RMB Shapeshift — bear and wolf forms are separate actor-kind sheets. Base druid sheet renders the *caster in human form only.* |
| hunter (§5.5) | RMB Pet Command — the wolf pet is actor kind `wolf_pet`, separate sheet. |
| cultist (§5.10) | Summons drowned-spawn tentacles — separate actor kind. |
| leper (§5.14) | Rotting Tide revives enemies as rotting husks — separate actor kind. |
| master (§5.15) | Prestige class; defer entirely. |

Some RMB utilities have no visually distinct caster pose (e.g. Chef's Pocket Dish, Hunter's Pet Command). For those, skip — the runtime renderer falls back to `idle`.

## Step 4 — Download + composite

PixelLab returns *individual frame PNGs* per animation, not horizontal strips. The `scripts/composite-pixellab-sprites.py` helper turns them into the strip format `SpriteActorRenderer` expects.

```bash
# 1. Download the character bundle (URL from `get_character` response)
mkdir -p public/sprites/<guildId>/raw
curl --fail -L -o /tmp/char.zip "https://api.pixellab.ai/mcp/characters/<characterId>/download"
unzip /tmp/char.zip -d public/sprites/<guildId>/raw/

# 2. Composite east-direction frames into horizontal strips + write metadata.json
python scripts/composite-pixellab-sprites.py <guildId>

# 3. Remove the raw/ directory so it doesn't ship in the Vite bundle
rm -rf public/sprites/<guildId>/raw
```

The script classifies PixelLab's opaque folder names (e.g. `animating-af84334a`) using folder-prefix heuristics and frame counts. If you add new template mappings in Step 3, extend `FOLDER_PREFIX_MAP` / `FRAMECOUNT_AMBIGUOUS_MAP` at the top of the script.

Expected outcome — a `public/sprites/<guildId>/metadata.json` of this shape:

```json
{
  "guildId": "<guildId>",
  "frameSize": { "w": 64, "h": 64 },
  "facing": "right",
  "animations": {
    "idle":      { "frames": <N>, "frameDurationMs": 180, "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "walk":      { "frames": <N>, "frameDurationMs": 120, "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "run":       { "frames": <N>, "frameDurationMs": 90,  "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "jump":      { "frames": <N>, "frameDurationMs": 120, "loop": false, "anchor": { "x": 32, "y": 56 } },
    "attack_1":  { "frames": <N>, "frameDurationMs": 80,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "attack_2":  { "frames": <N>, "frameDurationMs": 80,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "attack_3":  { "frames": <N>, "frameDurationMs": 80,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_1": { "frames": <N>, "frameDurationMs": 90,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_2": { "frames": <N>, "frameDurationMs": 90,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_3": { "frames": <N>, "frameDurationMs": 90,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_4": { "frames": <N>, "frameDurationMs": 90,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_5": { "frames": <N>, "frameDurationMs": 150, "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "block":     { "frames": <N>, "frameDurationMs": 200, "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "hurt":      { "frames": <N>, "frameDurationMs": 100, "loop": false, "anchor": { "x": 32, "y": 56 } },
    "death":     { "frames": <N>, "frameDurationMs": 150, "loop": false, "anchor": { "x": 32, "y": 56 } }
  }
}
```

Replace each `<N>` with the actual frame count from the returned PNG (divide image width by 64). Durations are defaults from the design doc — tune later after in-game evaluation.

Rules:
- `idle` is mandatory. If it failed to generate, retry before shipping.
- Any animation you skip (e.g. `ability_4` where the guild has no visually distinct pose) is simply omitted. The runtime falls back per `src/rendering/sprite/animationFallback.ts`.

## Step 5 — In-game evaluation

1. `npm run dev`
2. Browser devtools: `localStorage.setItem('nannymud:sprites', '1')`, reload.
3. Select the guild, play a wave. Check:
   - Looping animations (`idle`, `walk`, `run`, `block`) cycle smoothly.
   - Non-looping animations (`attack_*`, `ability_*`, `hurt`, `death`) play once and hold.
   - Horizontal flip tracks character facing.
   - HP bar appears above the sprite.

**Retry gate #2:** any animation looks wrong → re-run *just that row* of Step 3 and overwrite the PNG. Don't regenerate the whole sheet.

## Step 6 — Commit

```bash
git add public/sprites/<guildId>/
git commit -m "feat(assets): PixelLab sprite sheet for <guildId>"
```
