export type DamageType = 'physical' | 'magical' | 'nature' | 'holy' | 'shadow' | 'necrotic' | 'psychic';

export type GroundZoneVfxStyle = 'ring' | 'puddle';

export interface GroundZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  remainingMs: number;
  ownerTeam: 'player' | 'enemy';
  ownerBattleTeam?: BattleTeam;
  effects: Partial<Record<StatusEffectType, { magnitude: number; durationMs: number }>>;
  damagePerTick: number;
  damageType: DamageType;
  vfxColor: string;
  vfxStyle: GroundZoneVfxStyle;
  nextPulseMsDown: number;
  triggerOnce?: boolean;
  triggerDamage?: number;
}
export type StatusEffectType =
  | 'slow' | 'root' | 'stun' | 'silence' | 'knockback' | 'blind' | 'taunt'
  | 'shield' | 'hot' | 'dot' | 'lifesteal' | 'armor_shred' | 'magic_shred'
  | 'untargetable' | 'stealth' | 'speed_boost' | 'damage_boost' | 'damage_reduction'
  | 'attack_speed_boost' | 'bless' | 'curse' | 'infected' | 'chilled' | 'revealed'
  | 'fear' | 'daze';

export interface StatusEffect {
  id: string;
  type: StatusEffectType;
  magnitude: number;
  durationMs: number;
  remainingMs: number;
  source: string;
  damageType?: DamageType;
  tickIntervalMs?: number;
  lastTickMs?: number;
}

export type StageId =
  | 'assembly' | 'market' | 'kitchen' | 'tower' | 'grove'
  | 'catacombs' | 'throne' | 'docks' | 'rooftops';

export type ActorKind =
  | 'adventurer' | 'knight' | 'mage' | 'druid' | 'hunter' | 'monk'
  | 'viking' | 'prophet' | 'vampire' | 'cultist' | 'champion' | 'darkmage'
  | 'chef' | 'leper' | 'master'
  | 'plains_bandit' | 'bandit_archer' | 'wolf' | 'bandit_brute' | 'bandit_king'
  | 'wolf_pet' | 'drowned_spawn' | 'rotting_husk' | 'wolf_form'
  | 'giant_blue_wolf' | 'vampire_lord' | 'cult_high_priest' | 'elder_druid'
  | 'plague_darkmage' | 'warlord' | 'shadow_master' | 'bandit_king_ii';

export type AnimationId =
  | 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land'
  | 'attack_1' | 'attack_2' | 'attack_3' | 'run_attack'
  | 'jump_attack' | 'block' | 'dodge' | 'hurt' | 'knockdown'
  | 'getup' | 'death' | 'ability_1' | 'ability_2' | 'ability_3' | 'ability_4' | 'ability_5'
  | 'channel' | 'grab' | 'throw' | 'pickup';

export type GuildId =
  | 'adventurer' | 'knight' | 'mage' | 'druid' | 'hunter' | 'monk'
  | 'viking' | 'prophet' | 'vampire' | 'cultist' | 'champion' | 'darkmage'
  | 'chef' | 'leper' | 'master';

export interface Stats {
  STR: number;
  DEX: number;
  CON: number;
  INT: number;
  WIS: number;
  CHA: number;
}

export interface AbilityDef {
  id: string;
  name: string;
  combo: string;
  baseDamage: number;
  scaleStat: keyof Stats | null;
  scaleAmount: number;
  cooldownMs: number;
  cost: number;
  castTimeMs: number;
  range: number;
  aoeRadius: number;
  damageType: DamageType;
  knockdown: boolean;
  knockbackForce: number;
  effects: Partial<Record<StatusEffectType, { magnitude: number; durationMs: number }>>;
  isHeal: boolean;
  isProjectile: boolean;
  projectileSpeed: number;
  isTeleport: boolean;
  teleportDist: number;
  isSummon: boolean;
  isChannel: boolean;
  channelDurationMs: number;
  isGroundTarget: boolean;
  piercing: boolean;
  description: string;
  vfxColor: string;
}

export interface ResourceDef {
  name: string;
  max: number;
  startValue: number;
  regenIdle: number;
  regenCombat: number;
  decayRate: number;
  color: string;
}

export interface GuildAbilityStrategy {
  priority: number;
  useAtCloseRange?: boolean;
  useAtLongRange?: boolean;
  maxHpPct?: number;
  minHpPct?: number;
  retreatToUse?: boolean;
  minResourcePct?: number;
}

export interface GuildStrategy {
  preferRange: 'close' | 'mid' | 'long';
  aggressionPct: number;
  blockOnReaction: boolean;
  resourceStrategy: 'spend' | 'hoard';
  retreatBelowHpPct?: number;
  abilities: Partial<Record<number | 'rmb', GuildAbilityStrategy>>;
}

export interface GuildDef {
  id: GuildId;
  name: string;
  color: string;
  initial: string;
  stats: Stats;
  hpMax: number;
  armor: number;
  magicResist: number;
  moveSpeed: number;
  jumpPower: number;
  resource: ResourceDef;
  abilities: AbilityDef[];
  rmb: AbilityDef;
  damageType: DamageType;
  description: string;
  strategy: GuildStrategy;
  rangedBasic?: { range: number; speed: number; damageType: DamageType; vfxColor: string };
}

export type AIBehavior = 'chaser' | 'archer' | 'packer' | 'brute' | 'boss' | 'none';

export interface EnemyDef {
  kind: ActorKind;
  name: string;
  color: string;
  initial: string;
  hp: number;
  armor: number;
  magicResist: number;
  moveSpeed: number;
  damage: number;
  attackRange: number;
  attackCooldownMs: number;
  ai: AIBehavior;
  dropCopper: [number, number];
  dropWeapon: string | null;
  dropWeaponChance: number;
  width: number;
  height: number;
  isRanged: boolean;
  projectileSpeed: number;
  projectileRange: number;
  phases?: BossPhase[];
}

export interface BossPhase {
  hpThreshold: number;
  abilities: string[];
  summons?: { kind: ActorKind; count: number }[];
  attackSpeedMult: number;
  damageMult: number;
}

export type ActorTeam = 'player' | 'enemy' | 'neutral';

export interface Actor {
  id: string;
  kind: ActorKind;
  team: ActorTeam;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: -1 | 1;
  width: number;
  height: number;
  hp: number;
  hpMax: number;
  hpDark: number;
  mp: number;
  mpMax: number;
  armor: number;
  magicResist: number;
  moveSpeed: number;
  stats: Stats;
  statusEffects: StatusEffect[];
  animationId: AnimationId;
  animationFrame: number;
  animationTimeMs: number;
  state: ActorState;
  stateTimeMs: number;
  isPlayer: boolean;
  guildId: GuildId | null;
  abilityCooldowns: Map<string, number>;
  rmbCooldown: number;
  comboHits: number;
  lastAttackTimeMs: number;
  knockdownTimeMs: number;
  getupTimeMs: number;
  invulnerableMs: number;
  heldPickup: Pickup | null;
  aiState: AIState;
  bossPhase: number;
  attackSpeedMult?: number;
  damageMult?: number;
  aiDifficulty?: number;
  summonedByPlayer: boolean;
  summonedBy?: string;
  petAiMode?: 'aggressive' | 'defensive' | 'passive';
  baseHpMax?: number;
  baseMoveSpeed?: number;
  bloodtally?: number;
  chiOrbs?: number;
  sanity?: number;
  shapeshiftForm?: 'none' | 'wolf';
  primedClass?: string;
  dishes?: string[];
  miasmaActive?: boolean;
  fivePointPalmTarget?: string;
  lastAttackedBy?: string;
  isAlive: boolean;
  deathTimeMs: number;
  score: number;
  battleTeam?: BattleTeam;
}

export type ActorState =
  | 'idle' | 'walking' | 'running' | 'jumping' | 'falling' | 'landing'
  | 'attacking' | 'blocking' | 'dodging' | 'hurt' | 'knockdown' | 'getup'
  | 'dead' | 'channeling' | 'casting' | 'grabbing' | 'holding';

export interface AIState {
  behavior: AIBehavior;
  targetId: string | null;
  lastActionMs: number;
  retreating: boolean;
  packRole: 'leader' | 'circler' | null;
  phase: number;
  patrolDir: 1 | -1;
  leapCooldown: number;
  windupActive: boolean;
  windupTimeMs: number;
  lungeMs: number;
  // VS-mode CPU only. Hysteresis state for pursuit — committed horizontal
  // direction (-1 = move left, 0 = stop/engage, 1 = move right). Held across
  // ticks so the CPU doesn't oscillate start/stop as |dx| flutters near the
  // attack-range boundary. SP-only; not mirrored in AIStateSchema.
  pursuitDir?: -1 | 0 | 1;
  // Cooldown between CPU ability fires (ms remaining).
  abilityCooldownMs?: number;
}

export interface Pickup {
  id: string;
  type: 'rock' | 'club';
  x: number;
  y: number;
  z: number;
  hitsLeft: number;
  heldBy: string | null;
}

export interface Projectile {
  id: string;
  ownerId: string;
  guildId: GuildId | null;
  team: ActorTeam;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  damageType: DamageType;
  range: number;
  traveled: number;
  radius: number;
  knockdown: boolean;
  knockbackForce: number;
  effects: Partial<Record<StatusEffectType, { magnitude: number; durationMs: number }>>;
  piercing: boolean;
  color: string;
  type: string;
  hitActorIds: string[];
}

export type VFXEventType =
  | 'projectile_spawn'
  | 'aoe_pop'
  | 'hit_spark'
  | 'heal_glow'
  | 'blink_trail'
  | 'damage_number'
  | 'status_text'
  | 'ability_name'
  | 'status_mark'
  | 'channel_pulse'
  | 'aura_pulse'
  | 'zone_pulse'
  | 'summon_spawn';

export interface VFXEvent {
  type: VFXEventType;
  color: string;
  x: number;
  y: number;
  z?: number;
  facing?: 1 | -1;
  radius?: number;
  style?: GroundZoneVfxStyle;
  vx?: number;
  vy?: number;
  x2?: number;
  y2?: number;
  value?: number;
  text?: string;
  isCrit?: boolean;
  isHeal?: boolean;
  guildId?: GuildId | null;
  abilityId?: string;
  ownerId?: string;
  targetId?: string;
  assetKey?: string;
}

export type LogTag = 'P1' | 'P2' | 'SYS';
export type LogTone = 'info' | 'damage' | 'ko' | 'round';

export interface LogEntry {
  id: number;
  tickId: number;
  tag: LogTag;
  tone: LogTone;
  text: string;
}

export interface RoundState {
  index: 0 | 1 | 2;
  wins: { p1: number; p2: number };
  timeRemainingMs: number;
  phase: 'intro' | 'fighting' | 'resolved' | 'matchOver';
  phaseStartedAtMs: number;
  winnerOfRound: 'p1' | 'p2' | 'draw' | null;
  matchWinner: 'p1' | 'p2' | 'draw' | null;
}

export type SimMode = 'story' | 'vs' | 'surv';

export interface ActorMatchStats {
  damageDealt: number;
  damageTaken: number;
  abilitiesCast: number;
  maxCombo: number;
  critHits: number;
  totalHits: number;
  healingDone: number;
  _comboRun: number;
}

export interface MatchStats {
  p1: ActorMatchStats;
  p2: ActorMatchStats;
}

export type WaveEnemy =
  | { kind: ActorKind; count: number; offsetX?: number; offsetY?: number }
  | { guild: GuildId; count: number; difficulty: number };

export interface Wave {
  triggerX: number;
  enemies: WaveEnemy[];
  triggered: boolean;
  cleared: boolean;
}

export type BattleTeam = 'A' | 'B' | 'C' | 'D' | null;

export interface BattleSlot {
  guildId: GuildId;
  type: 'human' | 'cpu' | 'off';
  team: BattleTeam;
}

export interface BattStatEntry {
  kills: number;
  deaths: number;
  dmgDealt: number;
  healing: number;
}

export interface SimState {
  tick: number;
  timeMs: number;
  player: Actor;
  enemies: Actor[];
  allies: Actor[];
  pickups: Pickup[];
  projectiles: Projectile[];
  groundZones: GroundZone[];
  vfxEvents: VFXEvent[];
  waves: Wave[];
  currentWave: number;
  cameraX: number;
  cameraLocked: boolean;
  phase: 'playing' | 'victory' | 'defeat' | 'paused';
  bossSpawned: boolean;
  score: number;
  rngSeed: number;
  rng: () => number;
  nextActorId: number;
  nextProjectileId: number;
  nextPickupId: number;
  nextEffectId: number;
  bloodtallyDecayMs: number;
  mode: SimMode;
  opponent: Actor | null;
  round: RoundState | null;
  combatLog: LogEntry[];
  nextLogId: number;
  controllers: Record<string, PlayerController>;
  matchStats: MatchStats;
  /** SP VS only — CPU opponent difficulty (0..5). Undefined in MP / story. */
  difficulty?: number;
  /** True when created via createSurvivalState. Never mutated after init. */
  survivalMode: boolean;
  /** Running score. Incremented when waves clear. Only meaningful when survivalMode. */
  survivalScore: number;
  battleMode: boolean;
  battleSlots: BattleSlot[];
  battleTimer: number;
  battleDifficulty: number;
  battStats: Record<string, BattStatEntry> | null;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  attack: boolean;
  block: boolean;
  grab: boolean;
  pause: boolean;
  leftJustPressed: boolean;
  rightJustPressed: boolean;
  jumpJustPressed: boolean;
  attackJustPressed: boolean;
  blockJustPressed: boolean;
  grabJustPressed: boolean;
  pauseJustPressed: boolean;
  fullscreenToggleJustPressed: boolean;
  lastLeftPressMs: number;
  lastRightPressMs: number;
  runningLeft: boolean;
  runningRight: boolean;
  testAbilitySlot: number | 'rmb' | null;
}

export interface ComboBuffer {
  entries: { key: string; timeMs: number }[];
  lastKeyMs: number;
}

export interface PlayerController {
  input: InputState;
  comboBuffer: ComboBuffer;
  lastAttackMs: number;
  blockingMs: number;
  dodgeMs: number;
  parryWindowMs: number;
  channelMs: number;
  channelingAbility: string | null;
  castingAbility: string | null;
  castMs: number;
  groundTargetX: number;
  groundTargetY: number;
  attackChain: number;
  runningDir: number;
  fromStealthAttack?: boolean;
}
