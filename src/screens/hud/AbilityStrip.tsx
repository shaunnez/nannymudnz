import type { Actor } from '@nannymud/shared/simulation/types';
import { getGuild } from '@nannymud/shared/simulation/guildData';
import { theme } from '../../ui';
import { ComboDisplay } from '../../ui/ComboDisplay';

interface Props {
  actor: Actor;
  side: 'p1' | 'p2';
  showKeys: boolean;
  simTimeMs: number;
}

const KEY_LABELS = ['1', '2', '3', '4', '5', 'R'];

const ABILITY_ICONS: Record<string, string> = {
  // Adventurer
  rallying_cry: '📣', slash: '⚔', bandage: '✚', quickshot: '→', adrenaline_rush: '⚡', second_wind: '💨',
  // Knight
  holy_rebuke: '✦', valorous_strike: '🗡', taunt: '!', shield_wall: '🛡', last_stand: '☠', shield_block: '🛡',
  // Mage
  ice_nova: '❄', frostbolt: '❄', blink: '✦', arcane_shard: '◆', meteor: '☄', short_teleport: '↯',
  // Druid
  wild_growth: '🌿', entangle: '🌱', rejuvenate: '✚', cleanse: '✦', tranquility: '☯', shapeshift: '🐾',
  // Hunter
  disengage: '↙', piercing_volley: '⟹', aimed_shot: '🎯', bear_trap: '⚙', rain_of_arrows: '↓', pet_command: '🐺',
  // Monk
  serenity: '☯', flying_kick: '👊', jab: '•', five_point_palm: '✋', dragons_fury: '🐉', monk_parry: '◈',
  // Viking
  whirlwind: '↻', harpoon: '⚓', bloodlust: '⚡', axe_swing: '⚔', undying_rage: '☠', shield_bash: '█',
  // Prophet
  prophetic_shield: '◎', smite: '✦', bless: '★', curse: '☆', divine_intervention: '✝', divine_insight: '👁',
  // Vampire
  hemorrhage: '🩸', shadow_step: '▸', blood_drain: '◉', fang_strike: '⚔', nocturne: '🌑', mist_step: '▸',
  // Cultist
  summon_spawn: '☾', whispers: '~', madness: '∞', tendril_grasp: '⌖', open_the_gate: '⊕', gaze_abyss: '👁',
  // Champion
  tithe_of_blood: '⚔', berserker_charge: '▶', execute: '✕', cleaver: '⚔', skullsplitter: '💀', challenge: '!',
  // Darkmage
  darkness: '🌑', grasping_shadow: '◉', soul_leech: '◎', shadow_bolt: '◆', eternal_night: '☾', shadow_cloak: '▪',
  // Chef
  feast: '🍽', ladle_bash: '🥄', hot_soup: '♨', spice_toss: '✦', signature_dish: '⭐', pocket_dish: '🍴',
  // Leper
  plague_vomit: '☣', diseased_claw: '✕', necrotic_embrace: '⊕', contagion: '☣', rotting_tide: '~', miasma: '◉',
  // Master
  chosen_strike: '★', chosen_utility: '↯', chosen_nuke: '◆', eclipse: '◎', apotheosis: '✦', class_swap: '↺',
};

export function AbilityStrip({ actor, side, showKeys, simTimeMs }: Props) {
  const guild = getGuild(actor.guildId!);
  const cards = [...guild.abilities.slice(0, 5), guild.rmb];

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {cards.map((a, i) => {
        const cdUntil = actor.abilityCooldowns.get(a.id) ?? 0;
        const cdRemaining = Math.max(0, cdUntil - simTimeMs);
        const onCd = cdRemaining > 0;
        const cdFrac = onCd ? cdRemaining / a.cooldownMs : 0;
        const cdSecs = Math.ceil(cdRemaining / 1000);
        const unaffordable = actor.mp < a.cost;
        const dim = onCd || unaffordable;

        return (
          <div
            key={a.id}
            style={{
              position: 'relative',
              width: 68,
              height: 92,
              background: theme.panel,
              border: `1px solid ${side === 'p1' ? theme.team1 : theme.team2}`,
              borderRadius: 4,
              padding: 5,
              opacity: dim ? 0.45 : 1,
              fontFamily: theme.fontMono,
              fontSize: 11,
              color: theme.ink,
              overflow: 'hidden',
            }}
          >
            {showKeys && (
              <div style={{ position: 'absolute', top: 3, left: 5, fontSize: 14, fontWeight: 700, color: theme.inkDim, letterSpacing: 0 }}>
                {KEY_LABELS[i]}
              </div>
            )}
            <div style={{ position: 'absolute', top: 3, right: 5, fontSize: 11, color: theme.accent }}>
              {a.cost}
            </div>
            {/* Icon glyph — centre of slot, above name area */}
            <div
              style={{
                position: 'absolute',
                top: '38%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: 20,
                lineHeight: 1,
                textAlign: 'center',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {ABILITY_ICONS[a.id] ?? '?'}
            </div>
            <div style={{ position: 'absolute', bottom: 5, left: 4, right: 4, textAlign: 'center' }}>
              <div style={{ fontSize:8, lineHeight: 1.1, marginBottom: 3, color: theme.ink }}>{a.name}</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ComboDisplay combo={a.combo} size={10} color={theme.inkMuted} gap={2} />
              </div>
            </div>
            {onCd && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${cdFrac * 100}%`,
                  background: 'rgba(0,0,0,0.6)',
                  pointerEvents: 'none',
                }}
              />
            )}
            {onCd && (
              <div
                style={{
                  position: 'absolute',
                  top: '38%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: cdSecs >= 10 ? 14 : 18,
                  fontWeight: 700,
                  color: '#fff',
                  textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  zIndex: 2,
                }}
              >
                {cdSecs}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
