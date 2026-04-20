
Plan
Build simulation layer (types, constants, guilds, enemies, combat, AI, stage)
Build rendering layer (actor renderer abstraction, placeholder, HUD, particles)
Build input and audio systems
Build React screens (Title, Guild Select, Game, Game Over)
Wire everything together and verify build
Plan completed
Open details

Wrote
README.md
Open
Nannymud is built and running. Here's what was delivered:

What was built:

Title screen with animated fighters and a start button
Guild select screen — all 15 guilds with stat bars, ability descriptions, and resource info
Full game on the Plains of Nan with 6 waves ending in the 3-phase Bandit King boss
Victory and defeat screens with animated outcomes and retry/menu buttons
Gameplay systems working:

2.5D depth-plane movement — dodge by stepping up/down, not just left/right
Full combo grammar (↓↓J / →→J / ↓↑J / ←→J / ↓↑↓↑J + K+J utility) across all 15 guilds
Block, parry, dodge roll with invulnerability frames
Knockdown, getup with i-frames, getup counter-attack
HP + hpDark two-layer health bar with regen
Per-guild resources (Stamina, Resolve, Mana, Chi orbs, Rage, Faith, Bloodpool, Sanity, Bloodtally, etc.)
Rock and club environmental pickups — grab, wield, or throw
Floating damage numbers (yellow/orange crit/green heal), AoE flash particles, blink trails
Enemy AI: chaser, archer kiter, wolf pack leader/circler, brute with telegraph windup, and 3-phase boss
Synth music and SFX via Web Audio API — no audio files needed
Settings volume in localStorage
Architecture: The simulation layer has zero DOM/canvas dependencies — it can be moved to a Node server later without touching any game logic.