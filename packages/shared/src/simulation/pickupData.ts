import type { StatusEffectType } from './types';

export type PickupCategory = 'weapon' | 'gem' | 'consumable' | 'throwable' | 'crate';

export type PickupType =
  | 'rock' | 'club'
  | 'knife' | 'bat' | 'axe' | 'chain' | 'torch' | 'throwing_star'
  | 'bomb' | 'smoke_bomb' | 'bottle'
  | 'ruby' | 'sapphire' | 'emerald' | 'amethyst' | 'topaz'
  | 'health_potion' | 'chi_flask' | 'rage_tonic' | 'antidote' | 'iron_skin';

export interface PickupDef {
  type: PickupType;
  category: PickupCategory;
  name: string;
  color: string;
  damage?: number;
  attackRange?: number;
  attackCooldownMs?: number;
  throwable: boolean;
  throwDamage?: number;
  throwRange?: number;
  throwRadius?: number;
  hitEffect?: Partial<Record<StatusEffectType, { magnitude: number; durationMs: number }>>;
  holdBonus?: StatusEffectType;
  holdMagnitude?: number;
  instantHeal?: number;
  instantResourceRestore?: number;
  cleanseOnUse?: boolean;
  instantEffects?: Array<{ type: StatusEffectType; magnitude: number; durationMs: number }>;
}

export const PICKUP_DEFS: Record<PickupType, PickupDef> = {
  rock: {
    type: 'rock', category: 'throwable', name: 'Rock', color: '#9ca3af',
    throwable: true, throwDamage: 20, throwRange: 400, throwRadius: 10,
    hitEffect: { stun: { magnitude: 1, durationMs: 300 } },
  },
  club: {
    type: 'club', category: 'weapon', name: 'Club', color: '#92400e',
    damage: 28, attackRange: 70, attackCooldownMs: 700,
    throwable: true, throwDamage: 22, throwRange: 300, throwRadius: 10,
  },
  knife: {
    type: 'knife', category: 'weapon', name: 'Knife', color: '#c0c0c0',
    damage: 20, attackRange: 45, attackCooldownMs: 500,
    throwable: true, throwDamage: 18, throwRange: 350, throwRadius: 8,
  },
  bat: {
    type: 'bat', category: 'weapon', name: 'Bat', color: '#7c4a1e',
    damage: 32, attackRange: 60, attackCooldownMs: 750,
    throwable: true, throwDamage: 25, throwRange: 280, throwRadius: 10,
  },
  axe: {
    type: 'axe', category: 'weapon', name: 'Axe', color: '#4a4a4a',
    damage: 45, attackRange: 65, attackCooldownMs: 1100,
    throwable: true, throwDamage: 40, throwRange: 250, throwRadius: 10,
    hitEffect: { stun: { magnitude: 1, durationMs: 400 } },
  },
  chain: {
    type: 'chain', category: 'weapon', name: 'Chain', color: '#8a8a8a',
    damage: 22, attackRange: 90, attackCooldownMs: 800,
    throwable: false,
    hitEffect: { slow: { magnitude: 0.5, durationMs: 1000 } },
  },
  torch: {
    type: 'torch', category: 'weapon', name: 'Torch', color: '#8B4513',
    damage: 24, attackRange: 50, attackCooldownMs: 700,
    throwable: true, throwDamage: 18, throwRange: 320, throwRadius: 10,
    hitEffect: { dot: { magnitude: 5, durationMs: 3000 } },
  },
  throwing_star: {
    type: 'throwing_star', category: 'weapon', name: 'Throwing Star', color: '#a0a0a0',
    throwable: true, throwDamage: 30, throwRange: 600, throwRadius: 8,
  },
  bomb: {
    type: 'bomb', category: 'throwable', name: 'Bomb', color: '#2d2d2d',
    throwable: true, throwDamage: 60, throwRange: 350, throwRadius: 80,
    hitEffect: { stun: { magnitude: 1, durationMs: 500 } },
  },
  smoke_bomb: {
    type: 'smoke_bomb', category: 'throwable', name: 'Smoke Bomb', color: '#9aab9a',
    throwable: true, throwDamage: 0, throwRange: 350, throwRadius: 100,
    hitEffect: { blind: { magnitude: 1, durationMs: 3000 } },
  },
  bottle: {
    type: 'bottle', category: 'throwable', name: 'Bottle', color: '#4a7c59',
    throwable: true, throwDamage: 15, throwRange: 300, throwRadius: 10,
    hitEffect: { stun: { magnitude: 1, durationMs: 300 } },
  },
  ruby: {
    type: 'ruby', category: 'gem', name: 'Ruby', color: '#ef4444',
    throwable: false, holdBonus: 'damage_boost', holdMagnitude: 0.2,
  },
  sapphire: {
    type: 'sapphire', category: 'gem', name: 'Sapphire', color: '#3b82f6',
    throwable: false, holdBonus: 'speed_boost', holdMagnitude: 0.25,
  },
  emerald: {
    type: 'emerald', category: 'gem', name: 'Emerald', color: '#22c55e',
    throwable: false, holdBonus: 'hot', holdMagnitude: 3,
  },
  amethyst: {
    type: 'amethyst', category: 'gem', name: 'Amethyst', color: '#a855f7',
    throwable: false, holdBonus: 'damage_reduction', holdMagnitude: 12,
  },
  topaz: {
    type: 'topaz', category: 'gem', name: 'Topaz', color: '#eab308',
    throwable: false, holdBonus: 'attack_speed_boost', holdMagnitude: 0.2,
  },
  health_potion: {
    type: 'health_potion', category: 'consumable', name: 'Health Potion', color: '#ef4444',
    throwable: false, instantHeal: 150,
  },
  chi_flask: {
    type: 'chi_flask', category: 'consumable', name: 'Chi Flask', color: '#3b82f6',
    throwable: false, instantResourceRestore: 60,
  },
  rage_tonic: {
    type: 'rage_tonic', category: 'consumable', name: 'Rage Tonic', color: '#f97316',
    throwable: false,
    instantEffects: [
      { type: 'damage_boost', magnitude: 0.25, durationMs: 10_000 },
      { type: 'speed_boost', magnitude: 0.25, durationMs: 10_000 },
    ],
  },
  antidote: {
    type: 'antidote', category: 'consumable', name: 'Antidote', color: '#22c55e',
    throwable: false, cleanseOnUse: true,
  },
  iron_skin: {
    type: 'iron_skin', category: 'consumable', name: 'Iron Skin', color: '#94a3b8',
    throwable: false,
    instantEffects: [{ type: 'damage_reduction', magnitude: 20, durationMs: 8_000 }],
  },
};

export type StageId =
  | 'assembly' | 'market' | 'kitchen' | 'tower' | 'grove'
  | 'catacombs' | 'throne' | 'docks' | 'rooftops';

export const CRATE_LOOT_TABLE: PickupType[] = [
  'rock', 'rock', 'club', 'club',
  'bat', 'knife', 'axe', 'torch', 'bottle',
  'bomb', 'smoke_bomb',
  'health_potion', 'chi_flask',
  'ruby', 'sapphire', 'emerald', 'amethyst', 'topaz',
];

export const STAGE_CRATES: Record<StageId, { x: number; y: number }[]> = {
  assembly:  [{ x: 600, y: 180 }, { x: 1600, y: 240 }, { x: 2800, y: 200 }],
  market:    [{ x: 500, y: 200 }, { x: 1800, y: 160 }, { x: 2600, y: 220 }],
  kitchen:   [{ x: 700, y: 190 }, { x: 1500, y: 250 }, { x: 2400, y: 180 }],
  tower:     [{ x: 600, y: 170 }, { x: 1700, y: 210 }, { x: 2900, y: 190 }],
  grove:     [{ x: 500, y: 200 }, { x: 1400, y: 230 }, { x: 2700, y: 200 }],
  catacombs: [{ x: 650, y: 180 }, { x: 1600, y: 200 }, { x: 2800, y: 220 }],
  throne:    [{ x: 600, y: 190 }, { x: 1800, y: 170 }, { x: 3000, y: 210 }],
  docks:     [{ x: 550, y: 200 }, { x: 1500, y: 240 }, { x: 2600, y: 190 }],
  rooftops:  [{ x: 700, y: 180 }, { x: 1700, y: 220 }, { x: 2900, y: 200 }],
};
