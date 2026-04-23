# Runbook - Review Design Drift

## Purpose

Use this runbook to compare the live implementation against the handoff design package and turn visual drift into actionable, categorized findings.

This is not a blind "match the mockup exactly" process.

The goal is to identify:

- what is missing
- what is worse
- what is acceptably different
- what is actually better in the live app

## Reference inputs

- `design_handoff_nannymud/nannymud-design.pdf.pdf`
- `design_handoff_nannymud/README.md`
- `design_handoff_nannymud/Nannymud Screens.html`
- `design_handoff_nannymud/screens-*.jsx`

## Implementation inputs

- `src/App.tsx`
- `src/screens/`
- `src/screens/mp/`
- `src/screens/hud/`

## Capture workflow

1. Build a screen manifest.
2. Capture the reference screen from the handoff package.
3. Capture the equivalent implementation screen.
4. Compare side by side.
5. Log one categorized verdict.

## Suggested verdicts

- `missing`
- `worse`
- `acceptable drift`
- `better than handoff`

## What to compare

### Layout

- major regions present
- relative spacing
- panel structure
- hierarchy of information

### Visual language

- typography
- color usage
- borders and panel treatment
- iconography / monograms / chips

### Interaction

- navigation affordances
- focus/selection behavior
- CTA placement
- keyboard hint visibility

### Gameplay-readability exceptions

If the implementation diverges from the handoff because it improves usability or combat readability, record that explicitly instead of filing it as a bug.

## Output format

For each screen:

- `screen id`
- `reference source`
- `implementation route/state`
- `verdict`
- `top differences`
- `recommended action`

Example:

- `mp_lobby`
- `screens-05.jsx`
- `screen=mp_lobby`
- `worse`
- `Current implementation is missing right-side chat and room meta strip; slot layout is simplified`
- `Create issues for room meta strip and chat panel; keep current launch CTA placement if usability is better`

## Definition Of Done

A design drift review pass is done when:

- the major flows have been captured
- each flow has a verdict
- fix-worthy gaps are converted into backlog items
- better-than-handoff divergences are explicitly preserved
