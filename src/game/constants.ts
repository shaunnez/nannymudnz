// Render-only constants, owned by the Phaser layer.
// Re-exports from src/rendering/constants.ts during Phase 2; Task 15 deletes
// the old file and makes this the canonical home.

export {
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
  CANVAS_BUFFER_WIDTH,
  CANVAS_BUFFER_HEIGHT,
  RENDER_SCALE,
  DEPTH_SCALE,
  WORLD_Y_MIN,
  WORLD_Y_MAX,
  worldYToScreenY,
} from '../rendering/constants';
