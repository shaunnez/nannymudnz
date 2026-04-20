// CustomEvent emitted on the window when the user exits browser fullscreen,
// so GameScreen can auto-pause. Kept decoupled from React state to avoid
// prop-drilling through the screen router.
export const FULLSCREEN_EXIT_EVENT = 'nannymud:fullscreen-exit';
