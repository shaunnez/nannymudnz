// Render-only constants, owned by the Phaser layer.
// Never imported by anything under src/simulation/.

// The virtual coordinate space Phaser scenes draw into. Phaser.Scale.FIT
// scales this up to whatever the browser gives us while preserving 16:9.
export const VIRTUAL_WIDTH = 900;
export const VIRTUAL_HEIGHT = 506;

// Elevation (world-z → screen-y) falloff factor.
export const DEPTH_SCALE = 0.6;

// Depth-axis projection. Simulation y is a depth plane in [WORLD_Y_MIN, WORLD_Y_MAX];
// rendering maps that onto the vertical "stage" band of the canvas.
export const WORLD_Y_MIN = 60;
export const WORLD_Y_MAX = 380;

export function worldYToScreenY(worldY: number, canvasHeight: number): number {
  const screenYMin = canvasHeight * 0.42;
  const screenYMax = canvasHeight * 0.92;
  const t = (worldY - WORLD_Y_MIN) / (WORLD_Y_MAX - WORLD_Y_MIN);
  return screenYMin + t * (screenYMax - screenYMin);
}

// VS HUD band reservations — the React HUD overlay covers these strips,
// so the camera viewport shrinks to the middle to keep action centered.
export const HUD_TOP_PX = 72;
export const HUD_BOTTOM_PX = 160;
