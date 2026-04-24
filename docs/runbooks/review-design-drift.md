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

1. Read `docs/codex/plans/screen-manifest.md`.
2. If a screen/flow is missing, append a row using the schema in that file before capture starts.
3. Capture the reference screen from the handoff package.
4. Capture the equivalent implementation screen.
5. Compare side by side.
6. Log one categorized verdict using the stable output schema below.

## Verdicts And Labels

Use these verdict words in reviews and map them to these backlog labels:

| Verdict | Label |
|---|---|
| `missing` | `drift:missing` |
| `worse` | `drift:worse` |
| `acceptable` | `drift:acceptable` |
| `better` | `drift:better` |

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

## Output schema

Record findings as a markdown table with exactly these columns:

| screen_id | reference_source | impl_route | verdict | differences | action | label |
|---|---|---|---|---|---|---|

Column definitions:

- `screen_id`: stable id from `docs/codex/plans/screen-manifest.md`
- `reference_source`: handoff file or page used for comparison
- `impl_route`: route or state needed to reach the implementation screen
- `verdict`: one of `missing`, `worse`, `acceptable`, `better`
- `differences`: highest-signal summary of the visual/interaction drift
- `action`: recommended follow-up, preserve decision, or no-op
- `label`: mapped backlog label from the table above

Example:

| screen_id | reference_source | impl_route | verdict | differences | action | label |
|---|---|---|---|---|---|---|
| `mp_lobby` | `screens-05.jsx` | `state.screen='mp_lobby'` | `worse` | Missing right-side chat and room metadata strip; slot layout is simplified | Create follow-up work for room meta strip and chat panel; keep launch CTA placement if usability is better | `drift:worse` |

## Definition Of Done

A design drift review pass is done when:

- the major flows have been captured
- each flow has a verdict
- fix-worthy gaps are converted into backlog items or the active roadmap
- better-than-handoff divergences are explicitly preserved
