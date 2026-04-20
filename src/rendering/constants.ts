// Render-only constants. Never imported by anything under src/simulation/.
// The simulation works in world units; this file defines how those world units
// get projected to canvas pixels.

// The virtual coordinate space the renderer draws into. Matches the game's
// historical 900×500 canvas, slightly adjusted so (VIRTUAL_WIDTH : VIRTUAL_HEIGHT)
// equals (CANVAS_BUFFER_WIDTH : CANVAS_BUFFER_HEIGHT) for uniform scaling.
export const VIRTUAL_WIDTH = 900;
export const VIRTUAL_HEIGHT = 506;

// The canvas backing-buffer dimensions — what <canvas width/height> gets set to.
// 16:9 at 1600×900 lines up cleanly with ScalingFrame's 16:9 letterbox.
export const CANVAS_BUFFER_WIDTH = 1600;
export const CANVAS_BUFFER_HEIGHT = 900;

// Uniform scale applied once per frame via ctx.setTransform in GameScreen.
// CANVAS_BUFFER_WIDTH / VIRTUAL_WIDTH === CANVAS_BUFFER_HEIGHT / VIRTUAL_HEIGHT
// by construction (1600/900 === 900/506.25, rounded to 506).
export const RENDER_SCALE = CANVAS_BUFFER_WIDTH / VIRTUAL_WIDTH;

// Elevation (world-z → screen-y) falloff factor. Moved from simulation/constants.ts.
export const DEPTH_SCALE = 0.6;
