// Render-only constants, owned by the Phaser layer.
// Never imported by anything under src/simulation/.
import Phaser from 'phaser';

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

/**
 * Depth plane → scene-y. The simulation y axis is a depth plane; rendering
 * projects it onto a vertical band of the scene. The caller supplies the band
 * (min/max scene-y) because the visible gameplay strip depends on mode — in
 * story mode the camera fills the canvas; in VS/MP the React HUD covers the
 * top and bottom, so the camera viewport is shorter and the projection has to
 * land inside it.
 */
export function worldYToScreenY(worldY: number, screenYMin: number, screenYMax: number): number {
  const t = (worldY - WORLD_Y_MIN) / (WORLD_Y_MAX - WORLD_Y_MIN);
  return screenYMin + t * (screenYMax - screenYMin);
}

export interface ScreenYBand {
  min: number;
  max: number;
}

// VS HUD band reservations — the React HUD overlay covers these strips,
// so the camera viewport shrinks to the middle to keep action centered.
// Virtual-pixel (900×506) HUD reservations. The React overlay scales these
// proportionally via a transform so Phaser and HUD stay pixel-aligned at any
// display size — see HudOverlay.tsx.
export const HUD_TOP_PX = 80;
export const HUD_BOTTOM_PX = 220;

/** Scene-y band for story mode (camera fills canvas). */
export const SCREEN_Y_BAND_STORY: ScreenYBand = {
  min: VIRTUAL_HEIGHT * 0.42,
  max: VIRTUAL_HEIGHT * 0.92,
};

/**
 * Scene-y band for VS/MP. The camera viewport is the middle strip between the
 * React HUD panels — the camera's local (0,0) maps to the top of the visible
 * strip, so the band is relative to that strip, NOT the full canvas. Small
 * paddings keep feet + shadow clear of the panel borders.
 */
export const VS_VIEWPORT_HEIGHT = VIRTUAL_HEIGHT - HUD_TOP_PX - HUD_BOTTOM_PX;
// Widen the walkable depth band so the player can traverse closer to the top
// of the horizon and the bottom of the frame — the HUD panels already reserve
// the "chrome" area, so the whole viewport is fair-walk territory.
export const SCREEN_Y_BAND_VS: ScreenYBand = {
  min: Math.round(VS_VIEWPORT_HEIGHT * 0.24),
  max: Math.round(VS_VIEWPORT_HEIGHT * 0.96),
};

/**
 * Registry key used by GameplayScene to publish the current band to views.
 * Views read it once at construction and cache; mode doesn't change mid-scene.
 */
export const SCREEN_Y_BAND_KEY = 'screenYBand';

export function getScreenYBand(scene: Phaser.Scene): ScreenYBand {
  const band = scene.game.registry.get(SCREEN_Y_BAND_KEY) as ScreenYBand | undefined;
  return band ?? SCREEN_Y_BAND_STORY;
}
