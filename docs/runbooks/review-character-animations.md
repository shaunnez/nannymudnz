# Runbook - Review Character Animations

## Purpose

Use this runbook to review guild animation quality with a human in the loop.

This runbook is for judgment and polish, not just metadata correctness. The goal is to decide whether an animation should be:

- accepted
- metadata-tuned
- prompt-regenerated
- manually composited or trimmed

## Review Scope

Review these baseline animations first:

- `idle`
- `walk`
- `run`
- `jump`
- `attack_1`
- `attack_2`
- `attack_3`
- `block`
- `hurt`
- `death`

Review `ability_1` through `ability_5` after the basics are trustworthy.

## What To Check

### Readability

- Can the pose be understood instantly at gameplay scale?
- Does the silhouette stay readable on busy backgrounds?
- Does the action read without relying on VFX?

### Motion quality

- Are the feet planted or sliding unexpectedly?
- Does the torso drift in a floaty way?
- Does the animation snap too hard between frames?
- Does the timing feel too slow or too fast?

### Combat feel

- Does the attack have anticipation?
- Is the impact frame easy to spot?
- Does `hurt` clearly read as getting hit?
- Does `block` look defensive instead of idle?

### Consistency

- Is the guild scaled appropriately relative to the others?
- Does the anchor feel grounded?
- Does the weapon stay readable?
- Does the guild still match its class fantasy?

## Review Workflow

1. Review the strip in isolation.
2. Review the strip in motion in-game.
3. Compare against at least one stable baseline guild.
4. Record one verdict per animation:
   - `accept`
   - `tweak metadata`
   - `regenerate`
   - `needs human art pass`

## Common Fix Types

### Metadata tweak

Use when:

- the animation itself is good
- the problem is anchor, timing, or scale

Typical fixes:

- anchor x/y
- frame duration
- playback scale
- fallback mapping

### Regenerate

Use when:

- silhouette is weak
- motion is mushy
- pose is off-model
- impact read is poor

Typical causes:

- bad source generation
- poor prompt specificity
- weak body proportions
- bad action choice in source animation

### Manual art pass

Use when:

- animation is close but still uncanny
- one or two frames are breaking the loop
- source is salvageable with selective cleanup

## Human Notes Template

For each guild, record:

- `guildId`
- `animationId`
- `verdict`
- `issue summary`
- `why it matters in gameplay`
- `suggested next step`

Example:

- `knight`
- `attack_2`
- `regenerate`
- `Pose collapses and sword arc disappears mid-swing`
- `Impact frame is unreadable at gameplay scale`
- `Regenerate with clearer shield-leading slash and stronger follow-through`

## Codex Support Tasks

Codex can help by:

- measuring strip frame counts and metadata consistency
- spotting anchor/scale mismatches
- preparing review checklists
- keeping a per-guild punch-list
- converting human notes into prompt deltas
- recommending regenerate vs tune

## Definition Of Done

A guild's animation review is done when:

- the basic set has been reviewed in motion
- each animation has a verdict
- regenerate/tweak actions are logged
- the guild has a current status:
  - `approved`
  - `approved with tweaks`
  - `needs regeneration`
