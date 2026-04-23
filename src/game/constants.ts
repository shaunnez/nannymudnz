// Render-only constants, owned by the Phaser layer.
// Never imported by anything under src/simulation/.
import Phaser from 'phaser';

// The virtual coordinate space Phaser scenes draw into. Phaser.Scale.FIT
// scales this up to whatever the browser gives us while preserving 16:9.
export const VIRTUAL_WIDTH = 900;
export const VIRTUAL_HEIGHT = 506;

// Elevation (world-z → screen-y) falloff factor. Sim actor heights are ~60
// units while rendered sprites are 124px frames at 1.5× scale (~186px tall),
// so VFX placed at `actor.z + actor.height` need a larger scale than raw
// sim-to-screen depth or they land at knee level on the sprite.
export const DEPTH_SCALE = 1.8;

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
export const HUD_TOP_PX = 72;
export const HUD_BOTTOM_PX = 128;

/**
 * Scene-y band for all modes. The camera viewport is the middle strip between
 * the React HUD panels — the camera's local (0,0) maps to the top of the
 * visible strip, so the band is relative to that strip, NOT the full canvas.
 * Small paddings keep feet + shadow clear of the panel borders.
 */
export const VS_VIEWPORT_HEIGHT = VIRTUAL_HEIGHT - HUD_TOP_PX - HUD_BOTTOM_PX;
// Walkable depth band — actor feet project into this screen-y range (relative
// to the camera viewport). The min must be tall enough that a sprite drawn
// from its feet at `min` doesn't extend above the viewport into the top HUD.
// Sprites render at DISPLAY_SCALE=1.5 over an 80px frame (~120 virtual px),
// so `min` is clamped at the sprite's screen height + a small safety margin.
export const SCREEN_Y_BAND_VS: ScreenYBand = {
  min: 130,
  max: VS_VIEWPORT_HEIGHT - 8,
};

/**
 * Registry key used by GameplayScene to publish the current band to views.
 * Views read it once at construction and cache; mode doesn't change mid-scene.
 */
export const SCREEN_Y_BAND_KEY = 'screenYBand';

export function getScreenYBand(scene: Phaser.Scene): ScreenYBand {
  const band = scene.game.registry.get(SCREEN_Y_BAND_KEY) as ScreenYBand | undefined;
  return band ?? SCREEN_Y_BAND_VS;
}
