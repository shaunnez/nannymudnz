export const WORLD_WIDTH = 4000;
export const WORLD_HEIGHT = 400;
export const GRAVITY = 1200;
export const JUMP_VELOCITY = 600;
export const GROUND_Y_MIN = 180;
export const GROUND_Y_MAX = 440;
export const ACTOR_DEFAULT_WIDTH = 40;
export const ACTOR_DEFAULT_HEIGHT = 60;
export const BOSS_WIDTH = 80;
export const BOSS_HEIGHT = 120;
export const ATTACK_RANGE_DEFAULT = 60;
export const ATTACK_Y_TOLERANCE = 25;
export const COMBO_WINDOW_MS = 400;
export const COMBO_ATTACK_WINDOW_MS = 800;
export const DOUBLE_TAP_MS = 250;
export const BLOCK_REDUCTION = 0.8;
export const BLOCK_STAMINA_DRAIN = 5;
export const PARRY_WINDOW_MS = 200;
export const KNOCKDOWN_THRESHOLD = 50;
export const KNOCKDOWN_FLY_MS = 500;
export const KNOCKDOWN_LIE_MS = 800;
export const GETUP_ANIM_MS = 300;
export const HP_REGEN_RATE = 5;
export const HP_DARK_REGEN_RATE = 1;
export const HP_DARK_DECAY_FACTOR = 0.1;
export const CAMERA_LOCK_PADDING = 50;
export const SCROLL_SPEED = 8;
export const DODGE_DURATION_MS = 400;
export const DODGE_DISTANCE = 80;
export const DODGE_INVULN_MS = 400;
export const RUN_SPEED_MULT = 1.6;
export const COMBO_HINTS = {
  'down,down,attack': { name: 'Slot 1', slots: 1 },
  'right,right,attack': { name: 'Slot 2', slots: 2 },
  'down,up,attack': { name: 'Slot 3', slots: 3 },
  'left,right,attack': { name: 'Slot 4', slots: 4 },
  'down,up,down,up,attack': { name: 'Ultimate', slots: 5 },
};
export const PICKUP_GRAB_RANGE = 60;
export const GRAB_ENEMY_RANGE = 50;
export const AI_UPDATE_MS = 100;
export const PROJECTILE_RADIUS_DEFAULT = 8;
export const PLAYER_SPAWN_X = 200;
export const PLAYER_SPAWN_Y = 220;
export const BOSS_SPAWN_X = 3700;
export const BOSS_SPAWN_Y = 220;
export const ENEMY_SPAWN_Y_RANGE: [number, number] = [100, 340];
