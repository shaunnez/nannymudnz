# Screen Manifest

## Purpose

This file is the source of truth for design drift review targets. It maps handoff references to implementation routes/states and keeps screen coverage explicit.

## Schema

Use one row per screen or flow state.

| screen_id | reference_source | impl_route | implementation_surface | viewport | status | notes |
|---|---|---|---|---|---|---|

Column definitions:

- `screen_id`: stable id used by drift reports and follow-up work
- `reference_source`: handoff HTML, PDF page, or `screens-*.jsx` file
- `impl_route`: route or app state needed to reach the implementation screen
- `implementation_surface`: current React/Phaser entry point
- `viewport`: capture target such as `desktop-16:9`, `tablet`, or `mobile`
- `status`: `needs-mapping`, `ready-for-capture`, `captured`, or `reviewed`
- `notes`: gaps, known deviations, or capture instructions

## Initial inventory

| screen_id | reference_source | impl_route | implementation_surface | viewport | status | notes |
|---|---|---|---|---|---|---|
| `title` | `design_handoff_nannymud/Nannymud Screens.html` | `state.screen='title'` | `src/App.tsx -> TitleScreen` | `desktop-16:9` | `needs-mapping` | Map to exact `screens-*.jsx` source during first capture pass. |
| `menu` | `design_handoff_nannymud/Nannymud Screens.html` | `state.screen='menu'` | `src/App.tsx -> MainMenu` | `desktop-16:9` | `needs-mapping` | Main menu drift should include mode-selection affordances. |
| `charselect` | `design_handoff_nannymud/Nannymud Screens.html` | `state.screen='charselect'` | `src/App.tsx -> CharSelect` | `desktop-16:9` | `needs-mapping` | Verify guild card density and ready-state treatment. |
| `stage_select` | `design_handoff_nannymud/Nannymud Screens.html` | `state.screen='stage'` | `src/App.tsx -> StageSelect` | `desktop-16:9` | `needs-mapping` | Include stage preview, description, and CTA placement. |
| `game_story` | `design_handoff_nannymud/Nannymud Screens.html` | `state.screen='game'`, mode `story` | `src/App.tsx -> GameScreen` | `desktop-16:9` | `needs-mapping` | Compare HUD and framing, not combat feel. |
| `results` | `design_handoff_nannymud/Nannymud Screens.html` | `state.screen='results'` | `src/App.tsx -> ResultsScreen` | `desktop-16:9` | `needs-mapping` | Verify score, rematch/menu affordances, and visual emphasis. |
| `moves` | `design_handoff_nannymud/Nannymud Screens.html` | `state.screen='moves'` | `src/App.tsx -> MoveList` | `desktop-16:9` | `needs-mapping` | This is one of the duplicated guild-kit surfaces. |
| `guild_dossier` | `design_handoff_nannymud/Nannymud Screens.html` | `state.screen='guild_dossier'` | `src/App.tsx -> GuildDossier` | `desktop-16:9` | `needs-mapping` | Cross-check against `GuildDetails.tsx` and shared data adapters. |
| `settings` | `design_handoff_nannymud/Nannymud Screens.html` | `state.screen='settings'` | `src/App.tsx -> SettingsScreen` | `desktop-16:9` | `needs-mapping` | Include fullscreen and accessibility-adjacent controls. |
| `mp_hub` | `design_handoff_nannymud/Nannymud Screens.html` | `state.screen='mp_hub'` | `src/App.tsx -> MpHub` | `desktop-16:9` | `needs-mapping` | Compare host/join flow clarity. |
| `mp_lobby` | `design_handoff_nannymud/Nannymud Screens.html` | `state.screen='mp_lobby'` | `src/App.tsx -> MpLobby` | `desktop-16:9` | `needs-mapping` | Include room metadata, slots, and chat if present in handoff. |
| `mp_cs` | `design_handoff_nannymud/Nannymud Screens.html` | `state.screen='mp_cs'` | `src/App.tsx -> MpCharSelect` | `desktop-16:9` | `needs-mapping` | Compare to SP char select where relevant. |
| `mp_stage` | `design_handoff_nannymud/Nannymud Screens.html` | `state.screen='mp_stage'` | `src/App.tsx -> MpStageSelect` | `desktop-16:9` | `needs-mapping` | Verify ready-state and ownership cues. |
| `mp_load` | `design_handoff_nannymud/Nannymud Screens.html` | `state.screen='mp_load'` | `src/App.tsx -> MpLoadingScreen` | `desktop-16:9` | `needs-mapping` | Check for overlap with `src/screens/LoadingScreen.tsx`. |
| `mp_battle` | `design_handoff_nannymud/Nannymud Screens.html` | `state.screen='mp_battle'` | `src/App.tsx -> MpBattle` | `desktop-16:9` | `needs-mapping` | Compare HUD/chrome and framing, not nuanced combat feel. |
| `mp_results` | `design_handoff_nannymud/Nannymud Screens.html` | `state.screen='mp_results'` | `src/App.tsx` | `desktop-16:9` | `needs-mapping` | Placeholder row so drift review captures whether a dedicated results screen is missing. |
