import { useEffect, useState } from 'react';
import type { GuildId } from '@nannymud/shared/simulation/types';
import { SpriteStrip } from './SpriteStrip';

interface Props {
  guildId: GuildId;
  abilityId: string;
  animationId: string;
  spriteScale?: number;
  vfxScale?: number;
  spriteGuildId?: string;
}

type PreviewEffect =
  | 'viking_whirlwind'
  | 'viking_harpoon'
  | 'viking_bloodlust'
  | 'viking_axe_swing'
  | 'viking_undying_rage'
  | 'viking_shield_bash'
  | 'adventurer_rallying_cry'
  | 'adventurer_slash'
  | 'adventurer_bandage'
  | 'adventurer_adrenaline_rush'
  | 'adventurer_second_wind'
  | 'mage_ice_nova'
  | 'mage_blink'
  | 'mage_meteor'
  | 'mage_frostbolt'
  | 'mage_arcane_shard'
  | 'druid_wild_growth'
  | 'druid_channeling'
  | 'druid_shapeshift'
  | 'monk_jab'
  | 'monk_flying_kick'
  | 'monk_five_point'
  | 'monk_serenity'
  | 'monk_dragons_fury'
  | 'monk_parry'
  | 'champion_charge'
  | 'champion_execute'
  | 'champion_cleaver'
  | 'champion_skullsplitter'
  | 'champion_tithe'
  | 'champion_challenge'
  | 'hunter_disengage'
  | 'hunter_rain'
  | 'hunter_trap'
  | 'hunter_aimed_shot'
  | 'prophet_shield'
  | 'prophet_bless'
  | 'prophet_curse'
  | 'prophet_divine'
  | 'prophet_insight'
  | 'vampire_blood_drain'
  | 'vampire_nocturne'
  | 'vampire_fang_strike'
  | 'vampire_shadow_step'
  | 'darkmage_darkness'
  | 'darkmage_soul_leech'
  | 'darkmage_eternal_night'
  | 'darkmage_shadow_cloak'
  | 'cultist_madness'
  | 'cultist_gate'
  | 'cultist_gaze'
  | 'cultist_summon'
  | 'cultist_tendril'
  | 'chef_feast'
  | 'chef_ladle'
  | 'chef_soup'
  | 'chef_signature'
  | 'master_eclipse'
  | 'master_apotheosis'
  | 'master_chosen_strike'
  | 'master_chosen_nuke'
  | 'leper_plague'
  | 'leper_claw'
  | 'leper_embrace'
  | 'leper_contagion'
  | 'leper_tide'
  | 'leper_miasma';

interface AbilityPreviewSpec {
  effect?: PreviewEffect;
}

const TAU = Math.PI * 2;

function getAbilityPreviewSpec(guildId: GuildId, abilityId: string): AbilityPreviewSpec {
  switch (guildId) {
    case 'viking':
      switch (abilityId) {
        case 'whirlwind': return { effect: 'viking_whirlwind' };
        case 'harpoon': return { effect: 'viking_harpoon' };
        case 'bloodlust': return { effect: 'viking_bloodlust' };
        case 'axe_swing': return { effect: 'viking_axe_swing' };
        case 'undying_rage': return { effect: 'viking_undying_rage' };
        case 'shield_bash': return { effect: 'viking_shield_bash' };
        default: return {};
      }
    case 'adventurer':
      switch (abilityId) {
        case 'rallying_cry':    return { effect: 'adventurer_rallying_cry' };
        case 'slash':           return { effect: 'adventurer_slash' };
        case 'bandage':         return { effect: 'adventurer_bandage' };
        case 'adrenaline_rush': return { effect: 'adventurer_adrenaline_rush' };
        case 'second_wind':     return { effect: 'adventurer_second_wind' };
        default:                return {};
      }
    case 'mage':
      switch (abilityId) {
        case 'ice_nova':     return { effect: 'mage_ice_nova' };
        case 'blink':        return { effect: 'mage_blink' };
        case 'meteor':       return { effect: 'mage_meteor' };
        case 'frostbolt':    return { effect: 'mage_frostbolt' };
        case 'arcane_shard': return { effect: 'mage_arcane_shard' };
        default:             return {};
      }
    case 'druid':
      switch (abilityId) {
        case 'wild_growth':  return { effect: 'druid_wild_growth' };
        case 'rejuvenate':   return { effect: 'druid_channeling' };
        case 'cleanse':      return { effect: 'druid_channeling' };
        case 'tranquility':  return { effect: 'druid_channeling' };
        case 'shapeshift':   return { effect: 'druid_shapeshift' };
        default:             return {};
      }
    case 'monk':
      switch (abilityId) {
        case 'serenity':        return { effect: 'monk_serenity' };
        case 'flying_kick':     return { effect: 'monk_flying_kick' };
        case 'jab':             return { effect: 'monk_jab' };
        case 'five_point_palm': return { effect: 'monk_five_point' };
        case 'dragons_fury':    return { effect: 'monk_dragons_fury' };
        case 'monk_parry':      return { effect: 'monk_parry' };
        default:                return {};
      }
    case 'champion':
      switch (abilityId) {
        case 'tithe_of_blood':   return { effect: 'champion_tithe' };
        case 'berserker_charge': return { effect: 'champion_charge' };
        case 'execute':          return { effect: 'champion_execute' };
        case 'cleaver':          return { effect: 'champion_cleaver' };
        case 'skullsplitter':    return { effect: 'champion_skullsplitter' };
        case 'challenge':        return { effect: 'champion_challenge' };
        default:                 return {};
      }
    case 'hunter':
      switch (abilityId) {
        case 'disengage':      return { effect: 'hunter_disengage' };
        case 'aimed_shot':     return { effect: 'hunter_aimed_shot' };
        case 'bear_trap':      return { effect: 'hunter_trap' };
        case 'rain_of_arrows': return { effect: 'hunter_rain' };
        default:               return {};
      }
    case 'prophet':
      switch (abilityId) {
        case 'prophetic_shield':    return { effect: 'prophet_shield' };
        case 'bless':               return { effect: 'prophet_bless' };
        case 'curse':               return { effect: 'prophet_curse' };
        case 'divine_intervention': return { effect: 'prophet_divine' };
        case 'divine_insight':      return { effect: 'prophet_insight' };
        default:                    return {};
      }
    case 'vampire':
      switch (abilityId) {
        case 'blood_drain':  return { effect: 'vampire_blood_drain' };
        case 'fang_strike':  return { effect: 'vampire_fang_strike' };
        case 'nocturne':     return { effect: 'vampire_nocturne' };
        case 'shadow_step':  return { effect: 'vampire_shadow_step' };
        case 'mist_step':    return { effect: 'vampire_shadow_step' };
        default:             return {};
      }
    case 'darkmage':
      switch (abilityId) {
        case 'darkness':      return { effect: 'darkmage_darkness' };
        case 'soul_leech':    return { effect: 'darkmage_soul_leech' };
        case 'eternal_night': return { effect: 'darkmage_eternal_night' };
        case 'shadow_cloak':  return { effect: 'darkmage_shadow_cloak' };
        default:              return {};
      }
    case 'cultist':
      switch (abilityId) {
        case 'summon_spawn':  return { effect: 'cultist_summon' };
        case 'madness':       return { effect: 'cultist_madness' };
        case 'tendril_grasp': return { effect: 'cultist_tendril' };
        case 'open_the_gate': return { effect: 'cultist_gate' };
        case 'gaze_abyss':    return { effect: 'cultist_gaze' };
        default:              return {};
      }
    case 'chef':
      switch (abilityId) {
        case 'feast':          return { effect: 'chef_feast' };
        case 'ladle_bash':     return { effect: 'chef_ladle' };
        case 'hot_soup':       return { effect: 'chef_soup' };
        case 'signature_dish': return { effect: 'chef_signature' };
        default:               return {};
      }
    case 'master':
      switch (abilityId) {
        case 'chosen_strike':  return { effect: 'master_chosen_strike' };
        case 'chosen_nuke':    return { effect: 'master_chosen_nuke' };
        case 'eclipse':        return { effect: 'master_eclipse' };
        case 'apotheosis':     return { effect: 'master_apotheosis' };
        default:               return {};
      }
    case 'leper':
      switch (abilityId) {
        case 'plague_vomit':     return { effect: 'leper_plague' };
        case 'diseased_claw':    return { effect: 'leper_claw' };
        case 'necrotic_embrace': return { effect: 'leper_embrace' };
        case 'contagion':        return { effect: 'leper_contagion' };
        case 'rotting_tide':     return { effect: 'leper_tide' };
        case 'miasma':           return { effect: 'leper_miasma' };
        default:                 return {};
      }
    default:
      return {};
  }
}

function useLoopProgress(durationMs: number): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      setProgress(((now - start) % durationMs) / durationMs);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs]);

  return progress;
}

function getSpriteTransform(
  guildId: GuildId,
  effect: PreviewEffect | undefined,
  progress: number,
  spriteScale: number,
): string {
  let x = 0;
  let y = guildId === 'viking' ? 16 : 0;
  let scale = spriteScale * (guildId === 'viking' ? 1.9 : 1);

  switch (effect) {
    case 'viking_whirlwind':
      scale *= 1.1;
      y += 4;
      break;
    case 'viking_harpoon':
      x = -4 + Math.sin(progress * TAU) * 1.25;
      y += 6;
      break;
    case 'viking_bloodlust':
      y += 2;
      scale *= 1.01 + Math.sin(progress * TAU) * 0.015;
      break;
    case 'viking_undying_rage':
      scale *= 1.08 + Math.sin(progress * TAU) * 0.025;
      y += 2;
      break;
    case 'viking_shield_bash':
      x = -1 + Math.sin(progress * TAU) * 1.5;
      y += 6;
      break;
    case 'adventurer_rallying_cry':
      scale *= 1.0 + Math.sin(progress * TAU) * 0.02; y += 4; break;
    case 'adventurer_slash':
      x = 2 + Math.sin(progress * TAU) * 2; y += 4; break;
    case 'adventurer_bandage':
      scale *= 1.0 + Math.sin(progress * TAU * 2) * 0.015; y += 4; break;
    case 'adventurer_adrenaline_rush':
      scale *= 1.06 + Math.sin(progress * TAU) * 0.03; y += 2; break;
    case 'adventurer_second_wind':
      y += 4; break;
    case 'mage_ice_nova':
      scale *= 1.04 + Math.sin(progress * TAU) * 0.02; y += 4; break;
    case 'mage_frostbolt':
      x = -4 + Math.sin(progress * TAU) * 1.5; y += 4; break;
    case 'mage_arcane_shard':
      x = -3 + Math.sin(progress * TAU) * 2; y += 4; break;
    case 'mage_blink':
      x = -4 + Math.sin(progress * TAU) * 3; y += 4; break;
    case 'mage_meteor':
      scale *= 1.06 + Math.sin(progress * TAU) * 0.025; y += 2; break;
    case 'druid_wild_growth':
      scale *= 1.02 + Math.sin(progress * TAU) * 0.02; y += 4; break;
    case 'druid_channeling':
      scale *= 1.0 + Math.sin(progress * TAU * 2) * 0.015; y += 4; break;
    case 'druid_shapeshift':
      scale *= 1.06 + Math.sin(progress * TAU) * 0.025; y += 2; break;
    case 'monk_jab':
      x = 3 + Math.sin(progress * TAU) * 2; y += 4; break;
    case 'monk_flying_kick':
      x = 2 + Math.sin(progress * TAU) * 3; y += 2; break;
    case 'monk_five_point':
      scale *= 1.02 + Math.sin(progress * TAU) * 0.02; y += 4; break;
    case 'monk_serenity':
      scale *= 1.04 + Math.sin(progress * TAU) * 0.02; y += 2; break;
    case 'monk_dragons_fury':
      scale *= 1.0 + Math.sin(progress * TAU * 3) * 0.03; y += 2; break;
    case 'monk_parry':
      y += 4; break;
    case 'champion_charge':
      x = 3 + Math.sin(progress * TAU) * 2; y += 4; break;
    case 'champion_execute':
      scale *= 1.04 + Math.sin(progress * TAU) * 0.02; y += 2; break;
    case 'champion_cleaver':
      x = 2 + Math.sin(progress * TAU) * 2; y += 4; break;
    case 'champion_skullsplitter':
      scale *= 1.08 + Math.sin(progress * TAU) * 0.03; y += 2; break;
    case 'champion_tithe':
      scale *= 1.0 + Math.sin(progress * TAU * 2) * 0.02; y += 4; break;
    case 'champion_challenge':
      y += 4; break;
    case 'hunter_disengage':
      x = -2 - Math.sin(progress * TAU) * 3; y += 4; break;
    case 'hunter_rain':
      scale *= 1.0 + Math.sin(progress * TAU * 2) * 0.015; y += 2; break;
    case 'hunter_trap':
      y += 8; break;
    case 'hunter_aimed_shot':
      x = -3 + Math.sin(progress * TAU) * 1.5; y += 4; break;
    case 'prophet_shield':
      scale *= 1.02 + Math.sin(progress * TAU) * 0.02; y += 2; break;
    case 'prophet_bless':
      scale *= 1.0 + Math.sin(progress * TAU * 1.5) * 0.02; y += 4; break;
    case 'prophet_curse':
      scale *= 1.02 + Math.sin(progress * TAU) * 0.02; y += 4; break;
    case 'prophet_divine':
      scale *= 1.08 + Math.sin(progress * TAU) * 0.03; y += 2; break;
    case 'prophet_insight':
      scale *= 1.04 + Math.sin(progress * TAU) * 0.02; y += 2; break;
    case 'vampire_blood_drain':
      scale *= 1.0 + Math.sin(progress * TAU * 2) * 0.02; y += 4; break;
    case 'vampire_nocturne':
      scale *= 1.06 + Math.sin(progress * TAU) * 0.025; y += 2; break;
    case 'vampire_fang_strike':
      x = 2 + Math.sin(progress * TAU) * 2; y += 4; break;
    case 'vampire_shadow_step':
      x = -3 + Math.sin(progress * TAU) * 3; y += 4; break;
    case 'darkmage_darkness':
      scale *= 1.04 + Math.sin(progress * TAU) * 0.02; y += 2; break;
    case 'darkmage_soul_leech':
      scale *= 1.0 + Math.sin(progress * TAU * 2) * 0.02; y += 4; break;
    case 'darkmage_eternal_night':
      scale *= 1.06 + Math.sin(progress * TAU) * 0.025; y += 2; break;
    case 'darkmage_shadow_cloak':
      scale *= 1.04 + Math.sin(progress * TAU) * 0.02; y += 2; break;
    case 'cultist_summon':
      scale *= 1.04 + Math.sin(progress * TAU) * 0.02; y += 2; break;
    case 'cultist_madness':
      scale *= 1.0 + Math.sin(progress * TAU * 1.5) * 0.025; y += 2; break;
    case 'cultist_tendril':
      y += 6; break;
    case 'cultist_gate':
      scale *= 1.06 + Math.sin(progress * TAU) * 0.025; y += 2; break;
    case 'cultist_gaze':
      scale *= 1.02 + Math.sin(progress * TAU) * 0.018; y += 4; break;
    case 'chef_feast':
      scale *= 1.02 + Math.sin(progress * TAU) * 0.02; y += 4; break;
    case 'chef_ladle':
      x = 2 + Math.sin(progress * TAU) * 3; y += 4; break;
    case 'chef_soup':
      scale *= 1.0 + Math.sin(progress * TAU * 2) * 0.018; y += 4; break;
    case 'chef_signature':
      scale *= 1.04 + Math.sin(progress * TAU) * 0.025; y += 2; break;
    case 'master_chosen_strike':
      x = 2 + Math.sin(progress * TAU) * 2; y += 4; break;
    case 'master_chosen_nuke':
      scale *= 1.04 + Math.sin(progress * TAU) * 0.02; y += 2; break;
    case 'master_eclipse':
      scale *= 1.02 + Math.sin(progress * TAU * 0.5) * 0.03; y += 2; break;
    case 'master_apotheosis':
      scale *= 1.08 + Math.sin(progress * TAU) * 0.03; y += 2; break;
    case 'leper_claw':
      x = 3 + Math.sin(progress * TAU) * 3; y += 4; break;
    case 'leper_plague':
      scale *= 1.0 + Math.sin(progress * TAU) * 0.02; y += 3; break;
    case 'leper_tide':
      scale *= 1.0 + Math.sin(progress * TAU) * 0.025; break;
    default:
      break;
  }

  return `translate(${x}px, ${y}px) scale(${scale})`;
}

function getOverlayScale(effect: PreviewEffect | undefined, scale: number): number {
  switch (effect) {
    case 'viking_whirlwind':
      return Math.max(1.08, scale * 0.62);
    case 'viking_harpoon':
      return Math.max(1.02, scale * 0.58);
    case 'viking_axe_swing':
      return Math.max(1.06, scale * 0.6);
    case 'viking_bloodlust':
    case 'viking_undying_rage':
    case 'viking_shield_bash':
      return Math.max(0.98, scale * 0.54);
    default:
      return Math.max(0.98, scale * 0.54);
  }
}

function PreviewOverlay({
  effect,
  progress,
  scale,
}: {
  effect: PreviewEffect | undefined;
  progress: number;
  scale: number;
}) {
  if (!effect) return null;

  const overlayScale = getOverlayScale(effect, scale);
  const pulse = 0.55 + Math.sin(progress * TAU) * 0.25;
  const sweep = Math.sin(progress * TAU);
  const orbit = progress * TAU;

  let content: JSX.Element | null = null;

  switch (effect) {
    case 'viking_whirlwind':
      content = (
        <g transform={`rotate(${sweep * 10} 60 60)`}>
          <path d="M28 84 A28 28 0 0 1 28 36" fill="none" stroke="#f97316" strokeWidth={8.5} strokeLinecap="round" opacity={0.88 + pulse * 0.12} />
          <path d="M92 36 A28 28 0 0 1 92 84" fill="none" stroke="#fb923c" strokeWidth={8.5} strokeLinecap="round" opacity={0.82 + (1 - pulse) * 0.1} />
          <path d="M40 79 A18 18 0 0 1 40 45" fill="none" stroke="#fde68a" strokeWidth={4} strokeLinecap="round" opacity={0.95} />
          <path d="M80 41 A18 18 0 0 1 80 75" fill="none" stroke="#fdba74" strokeWidth={4} strokeLinecap="round" opacity={0.88} />
          <circle cx={34 + sweep * 3} cy={87} r="2.8" fill="#fff7ed" opacity="0.8" />
          <circle cx={86 - sweep * 3} cy={84} r="2.5" fill="#fed7aa" opacity="0.74" />
        </g>
      );
      break;
    case 'viking_harpoon': {
      const x = 72 + progress * 20;
      const y = 62 - Math.sin(progress * Math.PI) * 5;
      content = (
        <>
          <line x1={48} y1={62} x2={x + 8} y2={y} stroke="#5b3a29" strokeWidth={4.5} strokeLinecap="round" />
          <polygon points={`${x + 8},${y} ${x - 4},${y - 8} ${x - 4},${y + 8}`} fill="#cbd5e1" />
          <line x1={x - 7} y1={y - 6} x2={x + 1} y2={y} stroke="#cbd5e1" strokeWidth={3} strokeLinecap="round" />
          <line x1={x - 7} y1={y + 6} x2={x + 1} y2={y} stroke="#cbd5e1" strokeWidth={3} strokeLinecap="round" />
          <line x1={44} y1={62} x2={36} y2={62} stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" opacity="0.34" />
          <line x1={33} y1={66} x2={24} y2={66} stroke="#ffffff" strokeWidth={2} strokeLinecap="round" opacity="0.22" />
        </>
      );
      break;
    }
    case 'viking_bloodlust': {
      const dots = Array.from({ length: 3 }, (_, i) => {
        const angle = orbit + i * ((Math.PI * 2) / 3);
        return (
          <circle
            key={i}
            cx={60 + Math.cos(angle) * 12}
            cy={30 + Math.sin(angle) * 6}
            r="3.5"
            fill={i === 0 ? '#fca5a5' : '#ef4444'}
            opacity={0.88}
          />
        );
      });
      content = (
        <>
          <ellipse cx="60" cy="60" rx="28" ry="32" fill="#7f1d1d" opacity={0.2 + pulse * 0.12} />
          <ellipse cx="60" cy="60" rx="20" ry="24" fill="#ef4444" opacity={0.16 + pulse * 0.08} />
          <ellipse cx="60" cy="60" rx="30" ry="34" fill="none" stroke="#ef4444" strokeWidth={4} opacity={0.56 + pulse * 0.16} />
          {dots}
        </>
      );
      break;
    }
    case 'viking_axe_swing': {
      const offset = progress * 10;
      content = (
        <>
          <path d={`M50 ${88 - offset * 0.45} A30 30 0 0 1 92 42`} fill="none" stroke="#f97316" strokeWidth={9} strokeLinecap="round" opacity="0.96" />
          <path d={`M56 ${82 - offset * 0.35} A22 22 0 0 1 86 48`} fill="none" stroke="#fde68a" strokeWidth={4.5} strokeLinecap="round" opacity="0.96" />
          <circle cx={89} cy={44 + offset * 0.05} r="4" fill="#fff7ed" opacity="0.94" />
        </>
      );
      break;
    }
    case 'viking_undying_rage':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="28" ry="32" fill="#450a0a" opacity={0.22 + pulse * 0.1} />
          <ellipse cx="60" cy="60" rx="34" ry="39" fill="none" stroke="#dc2626" strokeWidth={5} opacity={0.9} />
          <ellipse cx="60" cy="60" rx="25" ry="29" fill="none" stroke="#fca5a5" strokeWidth={3.25} opacity={0.76} />
          <circle cx="37" cy="40" r="3.25" fill="#fca5a5" opacity="0.86" />
          <circle cx="83" cy="38" r="2.75" fill="#fca5a5" opacity="0.74" />
        </>
      );
      break;
    case 'viking_shield_bash': {
      const x = 77 + sweep * 3;
      content = (
        <>
          <path d="M64 50 Q84 58 64 68" fill="none" stroke="#94a3b8" strokeWidth={6} strokeLinecap="round" opacity="0.94" />
          <path d="M78 46 L86 56 L97 52 L90 60 L98 69 L86 68 L82 79 L77 68 L66 70 L73 60 L64 52 L77 55 Z" fill="#fde68a" opacity={0.74 + pulse * 0.14} />
          <circle cx={x} cy="60" r="4.25" fill="#fff7ed" opacity="0.82" />
        </>
      );
      break;
    }
    case 'adventurer_rallying_cry':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="32" ry="36" fill="none" stroke="#f59e0b" strokeWidth={4} opacity={0.72 + pulse * 0.2} />
          <ellipse cx="60" cy="60" rx="24" ry="28" fill="none" stroke="#fde68a" strokeWidth={2} opacity={0.58} />
          {[0,1,2].map(i => (
            <circle key={i} cx={60+Math.cos(orbit+i*TAU/3)*36} cy={60+Math.sin(orbit+i*TAU/3)*18} r="3" fill="#fbbf24" opacity={0.9} />
          ))}
        </>
      );
      break;
    case 'adventurer_slash':
      content = (
        <>
          <path d={`M44 ${74-sweep*4} A26 26 0 0 1 90 44`} fill="none" stroke="#c9a961" strokeWidth={8} strokeLinecap="round" opacity="0.95" />
          <path d={`M50 ${68-sweep*3} A18 18 0 0 1 84 50`} fill="none" stroke="#fde68a" strokeWidth={4} strokeLinecap="round" opacity="0.9" />
          <circle cx={88} cy={44} r="3.5" fill="#fff7ed" opacity="0.92" />
        </>
      );
      break;
    case 'adventurer_bandage':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="28" ry="32" fill="#14532d" opacity={0.15+pulse*0.1} />
          <ellipse cx="60" cy="60" rx="32" ry="36" fill="none" stroke="#22c55e" strokeWidth={3} opacity={0.62+pulse*0.28} />
          <line x1="60" y1="44" x2="60" y2="76" stroke="#86efac" strokeWidth={3} opacity={0.78} />
          <line x1="44" y1="60" x2="76" y2="60" stroke="#86efac" strokeWidth={3} opacity={0.78} />
          {[0,1,2,3].map(i => {
            const t=(progress*1.5+i*0.3)%1;
            return <circle key={i} cx={52+(i%2)*16} cy={72-t*32} r="2" fill="#4ade80" opacity={1-t} />;
          })}
        </>
      );
      break;
    case 'adventurer_adrenaline_rush':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="30" ry="34" fill="#7c2d12" opacity={0.18+pulse*0.1} />
          <ellipse cx="60" cy="60" rx="38" ry="42" fill="none" stroke="#f97316" strokeWidth={5} opacity={0.84+pulse*0.13} />
          <ellipse cx="60" cy="60" rx="26" ry="30" fill="none" stroke="#fde68a" strokeWidth={2.5} opacity={0.68} />
          {[0,1,2,3].map(i => (
            <circle key={i} cx={60+Math.cos(orbit*1.4+i*TAU/4)*32} cy={60+Math.sin(orbit*1.4+i*TAU/4)*16} r="2.5" fill="#fb923c" opacity={0.82} />
          ))}
        </>
      );
      break;
    case 'adventurer_second_wind':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="22" ry="26" fill="#78350f" opacity={0.16+pulse*0.12} />
          <ellipse cx="60" cy="60" rx="28" ry="32" fill="none" stroke="#f59e0b" strokeWidth={4} opacity={0.7+pulse*0.25} />
          {[0,1,2,3,4,5].map(i => {
            const angle=i*TAU/6; const r=22+pulse*8;
            return <circle key={i} cx={60+Math.cos(angle)*r} cy={60+Math.sin(angle)*r*0.58} r="2" fill="#fde68a" opacity={0.7+pulse*0.25} />;
          })}
        </>
      );
      break;
    case 'mage_ice_nova':
      content = (
        <>
          <circle cx="60" cy="60" r="34" fill="none" stroke="#93c5fd" strokeWidth={4} opacity={0.82 + pulse * 0.14} />
          <circle cx="60" cy="60" r="24" fill="none" stroke="#e0f2fe" strokeWidth={2} opacity={0.6} />
          {[0,1,2,3,4,5].map(i => {
            const a = orbit * 0.5 + i * TAU / 6;
            return (
              <polygon
                key={i}
                points={`${60+Math.cos(a)*30},${60+Math.sin(a)*30} ${60+Math.cos(a+0.28)*40},${60+Math.sin(a+0.28)*40} ${60+Math.cos(a-0.28)*40},${60+Math.sin(a-0.28)*40}`}
                fill="#bae6fd"
                opacity="0.88"
              />
            );
          })}
        </>
      );
      break;
    case 'mage_blink':
      content = (
        <>
          {[0,1,2,3].map(i => {
            const t = (progress + i * 0.25) % 1;
            return <circle key={i} cx={60 - t * 30} cy={62} r={3 * (1 - t)} fill="#c084fc" opacity={1 - t} />;
          })}
          <circle cx="38" cy="62" r="4" fill="#818cf8" opacity={0.6 + pulse * 0.3} />
        </>
      );
      break;
    case 'mage_frostbolt': {
      const bx = 16 + progress * 90;
      const by = 60;
      content = (
        <>
          {[1,2,3].map(i => {
            const tx = bx - i * 12;
            return <ellipse key={i} cx={tx} cy={by} rx={5 - i} ry={2.5 - i * 0.5} fill="#bae6fd" opacity={0.55 - i * 0.12} />;
          })}
          <ellipse cx={bx - 4} cy={by} rx="12" ry="3.5" fill="#93c5fd" opacity="0.82" />
          <ellipse cx={bx} cy={by} rx="7" ry="4.5" fill="#e0f2fe" opacity="0.95" />
          <circle cx={bx + 3} cy={by} r="2.5" fill="#fff" opacity="0.92" />
        </>
      );
      break;
    }
    case 'mage_arcane_shard': {
      const sx = 14 + progress * 92;
      const sy = 60;
      content = (
        <>
          {[1,2,3].map(i => {
            const tx = sx - i * 10;
            return <ellipse key={i} cx={tx} cy={sy} rx={3.5 - i * 0.5} ry={2 - i * 0.4} fill="#d946ef" opacity={0.5 - i * 0.12} />;
          })}
          <polygon points={`${sx + 13},${sy} ${sx - 5},${sy - 6} ${sx - 3},${sy} ${sx - 5},${sy + 6}`} fill="#c084fc" opacity="0.92" />
          <polygon points={`${sx + 10},${sy} ${sx - 3},${sy - 4} ${sx - 2},${sy} ${sx - 3},${sy + 4}`} fill="#e879f9" opacity="0.88" />
          <circle cx={sx + 8} cy={sy} r="2.5" fill="#fdf4ff" opacity="0.92" />
        </>
      );
      break;
    }
    case 'mage_meteor':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="34" ry="38" fill="#450a0a" opacity={0.2 + pulse * 0.1} />
          <ellipse cx="60" cy="60" rx="38" ry="42" fill="none" stroke="#ef4444" strokeWidth={5} opacity={0.88} />
          <ellipse cx="60" cy="60" rx="26" ry="30" fill="none" stroke="#fca5a5" strokeWidth={2.5} opacity={0.68} />
          {[0,1,2].map(i => {
            const a = orbit * 2 + i * TAU / 3;
            return <circle key={i} cx={60+Math.cos(a)*30} cy={60+Math.sin(a)*15} r="3" fill="#f97316" opacity="0.85" />;
          })}
        </>
      );
      break;
    case 'druid_wild_growth':
      content = (
        <>
          <circle cx="60" cy="60" r="34" fill="none" stroke="#4caf50" strokeWidth={4} opacity={0.82 + pulse * 0.14} />
          <circle cx="60" cy="60" r="22" fill="none" stroke="#86efac" strokeWidth={2} opacity={0.6} />
          <line x1="60" y1="26" x2="60" y2="94" stroke="#86efac" strokeWidth={2.5} opacity={0.7} />
          <line x1="26" y1="60" x2="94" y2="60" stroke="#86efac" strokeWidth={2.5} opacity={0.7} />
          {[0,1,2,3].map(i => {
            const a = Math.PI / 2 * i + orbit * 0.3;
            return <circle key={i} cx={60+Math.cos(a)*36} cy={60+Math.sin(a)*36} r="3" fill="#4ade80" opacity={0.9} />;
          })}
        </>
      );
      break;
    case 'druid_channeling':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="30" ry="34" fill="#14532d" opacity={0.14 + pulse * 0.08} />
          <ellipse cx="60" cy="60" rx="34" ry="38" fill="none" stroke="#4caf50" strokeWidth={3} opacity={0.65 + pulse * 0.25} />
          <ellipse cx="60" cy="60" rx="24" ry="28" fill="none" stroke="#86efac" strokeWidth={1.5} opacity={0.5} />
          {[0,1,2,3,4].map(i => {
            const t = (progress * 1.2 + i * 0.28) % 1;
            return <circle key={i} cx={52+(i%2)*16} cy={72-t*34} r="2" fill="#4ade80" opacity={1-t} />;
          })}
        </>
      );
      break;
    case 'druid_shapeshift':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="32" ry="36" fill="#14532d" opacity={0.18 + pulse * 0.1} />
          <ellipse cx="60" cy="60" rx="38" ry="42" fill="none" stroke="#65a30d" strokeWidth={5} opacity={0.82 + pulse * 0.14} />
          <ellipse cx="60" cy="60" rx="28" ry="32" fill="none" stroke="#4caf50" strokeWidth={2.5} opacity={0.65} />
          {[0,1,2,3,4,5].map(i => {
            const a = orbit * 0.8 + i * TAU / 6;
            return <circle key={i} cx={60+Math.cos(a)*34} cy={60+Math.sin(a)*17} r="2.5" fill="#4ade80" opacity={0.85} />;
          })}
        </>
      );
      break;
    case 'monk_jab':
      content = (
        <>
          <line x1="48" y1="62" x2={62 + sweep * 8} y2="62" stroke="#fcd34d" strokeWidth={5} strokeLinecap="round" opacity="0.92" />
          <circle cx={64 + sweep * 8} cy="62" r="3" fill="#fffbeb" opacity="0.9" />
        </>
      );
      break;
    case 'monk_flying_kick':
      content = (
        <>
          <path d={`M42 ${76 - sweep * 4} A30 30 0 0 1 90 44`} fill="none" stroke="#f59e0b" strokeWidth={8} strokeLinecap="round" opacity="0.95" />
          <path d={`M48 ${70 - sweep * 3} A22 22 0 0 1 84 50`} fill="none" stroke="#fde68a" strokeWidth={4} strokeLinecap="round" opacity="0.9" />
          <circle cx={88} cy={44} r="3.5" fill="#fffbeb" opacity="0.92" />
          <circle cx={78} cy={34 + sweep * 2} r="2.5" fill="#fcd34d" opacity="0.8" />
        </>
      );
      break;
    case 'monk_five_point':
      content = (
        <>
          {[0,1,2,3,4].map(i => {
            const a = i * TAU / 5 - Math.PI / 2;
            const r = 22 + pulse * 6;
            return <circle key={i} cx={60+Math.cos(a)*r} cy={60+Math.sin(a)*r} r="3.5" fill="#ef4444" opacity={0.85+pulse*0.12} />;
          })}
          <circle cx="60" cy="60" r="5" fill="#fcd34d" opacity={0.9+pulse*0.08} />
        </>
      );
      break;
    case 'monk_serenity':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="30" ry="34" fill="none" stroke="#fcd34d" strokeWidth={3} opacity={0.72 + pulse * 0.2} />
          <ellipse cx="60" cy="60" rx="22" ry="26" fill="none" stroke="#d9a441" strokeWidth={1.5} opacity={0.5} />
          {[0,1,2,3,4].map(i => {
            const a = orbit * 1.2 + i * TAU / 5;
            return <circle key={i} cx={60+Math.cos(a)*34} cy={60+Math.sin(a)*17} r="3" fill="#fcd34d" opacity={0.88} />;
          })}
        </>
      );
      break;
    case 'monk_dragons_fury':
      content = (
        <>
          <path d={`M ${60+Math.cos(orbit*8)*32} ${60+Math.sin(orbit*8)*16} A 32 16 0 0 1 ${60+Math.cos(orbit*8+2.5)*32} ${60+Math.sin(orbit*8+2.5)*16}`} fill="none" stroke="#f97316" strokeWidth={6} strokeLinecap="round" opacity="0.9" />
          {[0,1,2,3].map(i => {
            const a = orbit * 12 + i * TAU / 4;
            return <circle key={i} cx={60+Math.cos(a)*24} cy={60+Math.sin(a)*12} r="2.5" fill="#fcd34d" opacity={0.88} />;
          })}
        </>
      );
      break;
    case 'monk_parry':
      content = (
        <>
          <circle cx="60" cy="60" r={28 + pulse * 6} fill="none" stroke="#fcd34d" strokeWidth={4} opacity={0.8 + pulse * 0.18} />
          <circle cx="60" cy="60" r={18 + pulse * 4} fill="none" stroke="#fffbeb" strokeWidth={2} opacity={0.65} />
          {[0,1,2,3].map(i => {
            const a = i * TAU / 4;
            return <circle key={i} cx={60+Math.cos(a)*(28+pulse*6)} cy={60+Math.sin(a)*(28+pulse*6)} r="2.5" fill="#fcd34d" opacity="0.85" />;
          })}
        </>
      );
      break;
    case 'champion_charge':
      content = (
        <>
          <path d={`M42 ${76-sweep*4} A28 28 0 0 1 90 44`} fill="none" stroke="#dc2626" strokeWidth={9} strokeLinecap="round" opacity="0.94" />
          <path d={`M48 ${70-sweep*3} A20 20 0 0 1 84 50`} fill="none" stroke="#fca5a5" strokeWidth={4} strokeLinecap="round" opacity="0.85" />
          <circle cx={88} cy={44} r="4" fill="#fef2f2" opacity="0.9" />
        </>
      );
      break;
    case 'champion_execute':
      content = (
        <>
          <line x1="52" y1="30" x2="72" y2="88" stroke="#7f1d1d" strokeWidth={8} strokeLinecap="round" opacity="0.95" />
          <line x1="58" y1="30" x2="78" y2="88" stroke="#dc2626" strokeWidth={4} strokeLinecap="round" opacity="0.88" />
          {[0,1,2].map(i => (
            <circle key={i} cx={62+i*6} cy={68+i*8} r="2.5" fill="#dc2626" opacity="0.82" />
          ))}
        </>
      );
      break;
    case 'champion_cleaver':
      content = (
        <>
          <path d={`M46 ${72-sweep*3} A24 24 0 0 1 88 46`} fill="none" stroke="#a71d2a" strokeWidth={7} strokeLinecap="round" opacity="0.92" />
          <circle cx={86} cy={46} r="3" fill="#fca5a5" opacity="0.88" />
          <circle cx={76} cy={34} r="2.5" fill="#fca5a5" opacity="0.78" />
        </>
      );
      break;
    case 'champion_skullsplitter':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="36" ry="40" fill="#450a0a" opacity={0.22 + pulse * 0.1} />
          <ellipse cx="60" cy="60" rx="40" ry="44" fill="none" stroke="#dc2626" strokeWidth={6} opacity={0.9} />
          <ellipse cx="60" cy="60" rx="28" ry="32" fill="none" stroke="#fca5a5" strokeWidth={3} opacity={0.7} />
          {[0,1,2,3].map(i => {
            const a = i * TAU / 4 + orbit;
            return <circle key={i} cx={60+Math.cos(a)*34} cy={60+Math.sin(a)*17} r="3.5" fill="#fbbf24" opacity="0.88" />;
          })}
        </>
      );
      break;
    case 'champion_tithe':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="26" ry="30" fill="#7f1d1d" opacity={0.16 + pulse * 0.1} />
          <ellipse cx="60" cy="60" rx="32" ry="36" fill="none" stroke="#dc2626" strokeWidth={4} opacity={0.7 + pulse * 0.22} />
          {[0,1,2,3,4,5,6,7,8,9].map(i => {
            const a = i * TAU / 10 + orbit * 0.5;
            return <circle key={i} cx={60+Math.cos(a)*34} cy={60+Math.sin(a)*17} r="2" fill={i < 5 ? '#dc2626' : '#44403c'} opacity={i < 5 ? 0.85 : 0.3} />;
          })}
        </>
      );
      break;
    case 'champion_challenge':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="28" ry="32" fill="none" stroke="#a71d2a" strokeWidth={4} opacity={0.78 + pulse * 0.18} />
          <ellipse cx="60" cy="60" rx="20" ry="24" fill="none" stroke="#fbbf24" strokeWidth={2} opacity={0.65} />
          <line x1="60" y1="28" x2="60" y2="92" stroke="#fca5a5" strokeWidth={2.5} opacity={0.72} />
        </>
      );
      break;
    case 'hunter_disengage':
      content = (
        <>
          <circle cx="60" cy="60" r="30" fill="#78716c" opacity={0.28 + pulse * 0.1} />
          <circle cx="60" cy="60" r="34" fill="none" stroke="#a3e635" strokeWidth={3.5} opacity={0.8 + pulse * 0.16} />
          <circle cx="60" cy="60" r="22" fill="none" stroke="#d9f99d" strokeWidth={1.5} opacity={0.6} />
          {[0,1,2,3].map(i => {
            const a = orbit * 0.6 + i * TAU / 4;
            return <circle key={i} cx={60+Math.cos(a)*36} cy={60+Math.sin(a)*18} r="2.5" fill="#a3e635" opacity={0.85} />;
          })}
        </>
      );
      break;
    case 'hunter_rain':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="30" ry="34" fill="none" stroke="#a3e635" strokeWidth={2.5} opacity={0.65 + pulse * 0.2} />
          {[0,1,2,3,4,5].map(i => {
            const t = (progress * 2 + i * 0.2) % 1;
            const x = 38 + i * 10;
            return <line key={i} x1={x} y1={28 + t * 40} x2={x - 2} y2={32 + t * 40} stroke="#d9f99d" strokeWidth={2} strokeLinecap="round" opacity={1 - t} />;
          })}
        </>
      );
      break;
    case 'hunter_trap':
      content = (
        <>
          <circle cx="60" cy="74" r="16" fill="none" stroke="#8d6e63" strokeWidth={4} opacity={0.88} />
          <line x1="44" y1="74" x2="76" y2="74" stroke="#1c1917" strokeWidth={5} strokeLinecap="round" opacity="0.92" />
          <circle cx="60" cy="74" r="4" fill="#fbbf24" opacity={0.9 + pulse * 0.08} />
        </>
      );
      break;
    case 'hunter_aimed_shot':
      content = (
        <>
          <line x1="34" y1="62" x2={58 + progress * 24} y2="62" stroke="#8d6e63" strokeWidth={4} strokeLinecap="round" opacity="0.88" />
          <polygon points={`${60+progress*24},54 ${72+progress*24},62 ${60+progress*24},70`} fill="#d1d5db" opacity="0.85" />
          <line x1={55+progress*24} y1="56" x2={62+progress*24} y2="62" stroke="#cbd5e1" strokeWidth={3} strokeLinecap="round" opacity="0.75" />
          <line x1={55+progress*24} y1="68" x2={62+progress*24} y2="62" stroke="#cbd5e1" strokeWidth={3} strokeLinecap="round" opacity="0.75" />
        </>
      );
      break;
    case 'prophet_shield':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="34" ry="38" fill="none" stroke="#fde68a" strokeWidth={4} opacity={0.8 + pulse * 0.16} />
          <ellipse cx="60" cy="60" rx="24" ry="28" fill="none" stroke="#ffffff" strokeWidth={2} opacity={0.55} />
          <line x1="60" y1="22" x2="60" y2="98" stroke="#ffffff" strokeWidth={2.5} opacity={0.65} />
          <line x1="22" y1="60" x2="98" y2="60" stroke="#ffffff" strokeWidth={2.5} opacity={0.65} />
          {[0,1,2,3].map(i => {
            const a = orbit * 0.8 + i * TAU / 4;
            return <circle key={i} cx={60+Math.cos(a)*38} cy={60+Math.sin(a)*19} r="2.5" fill="#fbbf24" opacity={0.88} />;
          })}
        </>
      );
      break;
    case 'prophet_bless':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="30" ry="34" fill="none" stroke="#f7e8a4" strokeWidth={3.5} opacity={0.72 + pulse * 0.2} />
          <ellipse cx="60" cy="60" rx="22" ry="26" fill="none" stroke="#fde68a" strokeWidth={1.5} opacity={0.52} />
          {[0,1,2].map(i => {
            const a = orbit + i * TAU / 3;
            return <circle key={i} cx={60+Math.cos(a)*34} cy={60+Math.sin(a)*17} r="3" fill="#fbbf24" opacity={0.88} />;
          })}
        </>
      );
      break;
    case 'prophet_curse':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="28" ry="32" fill="#2e1065" opacity={0.18 + pulse * 0.1} />
          <ellipse cx="60" cy="60" rx="32" ry="36" fill="none" stroke="#7c3aed" strokeWidth={4} opacity={0.82 + pulse * 0.14} />
          <ellipse cx="60" cy="60" rx="22" ry="26" fill="none" stroke="#ede9fe" strokeWidth={1.5} opacity={0.55} />
          <line x1="60" y1="28" x2="60" y2="92" stroke="#7c3aed" strokeWidth={2.5} opacity={0.7} />
          <line x1="28" y1="60" x2="92" y2="60" stroke="#7c3aed" strokeWidth={2.5} opacity={0.7} />
        </>
      );
      break;
    case 'prophet_divine':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="36" ry="40" fill="#ffffff" opacity={0.2 + pulse * 0.12} />
          <ellipse cx="60" cy="60" rx="40" ry="44" fill="none" stroke="#ffffff" strokeWidth={6} opacity={0.88 + pulse * 0.1} />
          <ellipse cx="60" cy="60" rx="28" ry="32" fill="none" stroke="#fde68a" strokeWidth={2.5} opacity={0.72} />
          <line x1="60" y1="16" x2="60" y2="104" stroke="#ffffff" strokeWidth={3} opacity={0.65} />
          <line x1="16" y1="60" x2="104" y2="60" stroke="#ffffff" strokeWidth={3} opacity={0.65} />
        </>
      );
      break;
    case 'prophet_insight':
      content = (
        <>
          <circle cx="60" cy="60" r="36" fill="none" stroke="#ffffff" strokeWidth={4} opacity={0.78 + pulse * 0.18} />
          <circle cx="60" cy="60" r="26" fill="none" stroke="#fde68a" strokeWidth={2} opacity={0.6} />
          {[0,1,2,3,4,5,6,7].map(i => {
            const a = i * TAU / 8 + orbit * 0.4;
            return <circle key={i} cx={60+Math.cos(a)*38} cy={60+Math.sin(a)*38} r="2.5" fill="#fbbf24" opacity={0.85} />;
          })}
        </>
      );
      break;
    case 'vampire_blood_drain':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="28" ry="32" fill="#7f1d1d" opacity={0.16 + pulse * 0.1} />
          <ellipse cx="60" cy="60" rx="34" ry="38" fill="none" stroke="#dc2626" strokeWidth={3} opacity={0.7 + pulse * 0.22} />
          {[0,1,2,3,4,5].map(i => {
            const t = (progress * 1.8 + i * 0.22) % 1;
            const a = i * TAU / 6;
            const r = (1 - t) * 34;
            return <circle key={i} cx={60+Math.cos(a)*r} cy={60+Math.sin(a)*r*0.65} r="2" fill="#fca5a5" opacity={1-t} />;
          })}
        </>
      );
      break;
    case 'vampire_fang_strike':
      content = (
        <>
          <line x1="50" y1="38" x2="60" y2="76" stroke="#7a1935" strokeWidth={5} strokeLinecap="round" opacity="0.9" />
          <line x1="62" y1="38" x2="72" y2="76" stroke="#dc2626" strokeWidth={5} strokeLinecap="round" opacity="0.88" />
          <circle cx="60" cy="78" r="3.5" fill="#fca5a5" opacity="0.9" />
          <circle cx="72" cy="78" r="3" fill="#fca5a5" opacity="0.85" />
        </>
      );
      break;
    case 'vampire_nocturne':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="36" ry="40" fill="#0f0a1e" opacity={0.3 + pulse * 0.12} />
          <ellipse cx="60" cy="60" rx="40" ry="44" fill="none" stroke="#7a1935" strokeWidth={5} opacity={0.82 + pulse * 0.14} />
          <ellipse cx="60" cy="60" rx="28" ry="32" fill="none" stroke="#dc2626" strokeWidth={2} opacity={0.55} />
          {[0,1,2].map(i => {
            const a = orbit * 0.8 + i * TAU / 3;
            return <circle key={i} cx={60+Math.cos(a)*36} cy={60+Math.sin(a)*18} r="2.5" fill="#fca5a5" opacity={0.8} />;
          })}
        </>
      );
      break;
    case 'vampire_shadow_step':
      content = (
        <>
          {[0,1,2,3,4].map(i => {
            const t = (progress + i * 0.22) % 1;
            return (
              <ellipse key={i} cx={60 - i * 10} cy="62" rx={12 * (1-t*0.5)} ry={20 * (1-t*0.5)}
                fill="#7a1935" opacity={(1-t) * 0.55} />
            );
          })}
          <circle cx="36" cy="62" r="5" fill="#dc2626" opacity={0.5 + pulse * 0.3} />
        </>
      );
      break;
    case 'darkmage_darkness':
      content = (
        <>
          <circle cx="60" cy="60" r="34" fill="#030712" opacity={0.32 + pulse * 0.12} />
          <circle cx="60" cy="60" r="36" fill="none" stroke="#6d28d9" strokeWidth={4} opacity={0.8 + pulse * 0.16} />
          <circle cx="60" cy="60" r="26" fill="none" stroke="#a855f7" strokeWidth={2} opacity={0.55} />
          {[0,1,2,3].map(i => {
            const a = orbit * 0.6 + i * TAU / 4;
            return <circle key={i} cx={60+Math.cos(a)*38} cy={60+Math.sin(a)*19} r="2.5" fill="#a855f7" opacity={0.82} />;
          })}
        </>
      );
      break;
    case 'darkmage_soul_leech':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="26" ry="30" fill="#2e1065" opacity={0.18 + pulse * 0.1} />
          <ellipse cx="60" cy="60" rx="32" ry="36" fill="none" stroke="#6d28d9" strokeWidth={3} opacity={0.72 + pulse * 0.2} />
          {[0,1,2,3,4].map(i => {
            const t = (progress * 1.6 + i * 0.24) % 1;
            const a = i * TAU / 5;
            const r = (1 - t) * 32;
            return <circle key={i} cx={60+Math.cos(a)*r} cy={60+Math.sin(a)*r*0.6} r="2" fill="#a855f7" opacity={1-t} />;
          })}
        </>
      );
      break;
    case 'darkmage_eternal_night':
      content = (
        <>
          <circle cx="60" cy="60" r="38" fill="#030712" opacity={0.35 + pulse * 0.12} />
          <circle cx="60" cy="60" r="40" fill="none" stroke="#6d28d9" strokeWidth={5} opacity={0.85} />
          <circle cx="60" cy="60" r="30" fill="none" stroke="#a855f7" strokeWidth={2.5} opacity={0.65} />
          {[0,1,2,3,4,5].map(i => {
            const a = i * TAU / 6 + orbit * 0.4;
            return <circle key={i} cx={60+Math.cos(a)*42} cy={60+Math.sin(a)*42} r="2" fill="#ede9fe" opacity={0.72} />;
          })}
        </>
      );
      break;
    case 'darkmage_shadow_cloak':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="34" ry="38" fill="#1e1b4b" opacity={0.24 + pulse * 0.1} />
          <ellipse cx="60" cy="60" rx="36" ry="40" fill="none" stroke="#4a1458" strokeWidth={4} opacity={0.78 + pulse * 0.18} />
          <ellipse cx="60" cy="60" rx="26" ry="30" fill="none" stroke="#6d28d9" strokeWidth={2} opacity={0.5} />
          {[0,1,2].map(i => {
            const a = orbit * 0.9 + i * TAU / 3;
            return <circle key={i} cx={60+Math.cos(a)*34} cy={60+Math.sin(a)*17} r="2.5" fill="#a855f7" opacity={0.78} />;
          })}
        </>
      );
      break;
    case 'cultist_summon':
      content = (
        <>
          <circle cx="60" cy="60" r="36" fill="#000000" opacity={0.28 + pulse * 0.1} />
          <circle cx="60" cy="60" r="38" fill="none" stroke="#134e4a" strokeWidth={4} opacity={0.82 + pulse * 0.14} />
          <circle cx="60" cy="60" r="28" fill="none" stroke="#065f46" strokeWidth={2} opacity={0.58} />
          {[0,1,2,3,4,5].map(i => {
            const a = orbit * 0.6 + i * TAU / 6;
            return <circle key={i} cx={60+Math.cos(a)*40} cy={60+Math.sin(a)*20} r="2.5" fill="#4ade80" opacity={0.78} />;
          })}
        </>
      );
      break;
    case 'cultist_madness':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="32" ry="36" fill="#0a1a12" opacity={0.22 + pulse * 0.1} />
          <ellipse cx="60" cy="60" rx="36" ry="40" fill="none" stroke="#2e4c3a" strokeWidth={4} opacity={0.78 + pulse * 0.18} />
          <ellipse cx="60" cy="60" rx="24" ry="28" fill="none" stroke="#065f46" strokeWidth={2} opacity={0.52} />
          {[0,1,2,3,4].map(i => {
            const a = orbit * 1.2 + i * TAU / 5;
            return <circle key={i} cx={60+Math.cos(a)*34} cy={60+Math.sin(a)*17} r="2.5" fill="#d1fae5" opacity={0.72} />;
          })}
        </>
      );
      break;
    case 'cultist_tendril':
      content = (
        <>
          {[0,1,2,3].map(i => {
            const x = 36 + i * 14;
            return <line key={i} x1={x} y1="40" x2={x + (i%2)*4 - 2} y2={72 + pulse * 8} stroke="#065f46" strokeWidth={4} strokeLinecap="round" opacity={0.82 + pulse * 0.14} />;
          })}
          <ellipse cx="60" cy="74" rx="22" ry="8" fill="none" stroke="#134e4a" strokeWidth={2} opacity={0.65} />
        </>
      );
      break;
    case 'cultist_gate':
      content = (
        <>
          <circle cx="60" cy="60" r="38" fill="#000000" opacity={0.38 + pulse * 0.14} />
          <circle cx="60" cy="60" r="40" fill="none" stroke="#134e4a" strokeWidth={5} opacity={0.88} />
          <circle cx="60" cy="60" r="28" fill="none" stroke="#065f46" strokeWidth={2.5} opacity={0.65} />
          {[0,1,2,3].map(i => {
            const a = -orbit * 1.5 + i * TAU / 4;
            return <circle key={i} cx={60+Math.cos(a)*32} cy={60+Math.sin(a)*16} r="3" fill="#4ade80" opacity={0.82} />;
          })}
        </>
      );
      break;
    case 'cultist_gaze':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="28" ry="32" fill="none" stroke="#2e4c3a" strokeWidth={3.5} opacity={0.72 + pulse * 0.2} />
          <ellipse cx="60" cy="60" rx="20" ry="24" fill="none" stroke="#065f46" strokeWidth={1.5} opacity={0.5} />
          {[0,1,2].map(i => {
            const a = orbit + i * TAU / 3;
            return <circle key={i} cx={60+Math.cos(a)*32} cy={60+Math.sin(a)*16} r="2.5" fill="#4ade80" opacity={0.75} />;
          })}
        </>
      );
      break;
    case 'chef_feast':
      content = (
        <>
          <circle cx="60" cy="60" r="34" fill="none" stroke="#f48fb1" strokeWidth={4} opacity={0.8 + pulse * 0.16} />
          <circle cx="60" cy="60" r="24" fill="none" stroke="#fde68a" strokeWidth={2} opacity={0.62} />
          {[0,1,2,3].map(i => {
            const a = orbit * 0.8 + i * TAU / 4;
            return <circle key={i} cx={60+Math.cos(a)*36} cy={60+Math.sin(a)*18} r="3" fill="#f9a8d4" opacity={0.88} />;
          })}
        </>
      );
      break;
    case 'chef_ladle':
      content = (
        <>
          <path d={`M48 ${72-sweep*3} A22 22 0 0 1 84 48`} fill="none" stroke="#f48fb1" strokeWidth={7} strokeLinecap="round" opacity="0.92" />
          <circle cx={82} cy={48} r="4" fill="#fde68a" opacity="0.9" />
        </>
      );
      break;
    case 'chef_soup':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="26" ry="30" fill="#78350f" opacity={0.12 + pulse * 0.08} />
          <ellipse cx="60" cy="60" rx="30" ry="34" fill="none" stroke="#fde68a" strokeWidth={3.5} opacity={0.72 + pulse * 0.22} />
          <ellipse cx="60" cy="60" rx="20" ry="24" fill="none" stroke="#86efac" strokeWidth={1.5} opacity={0.55} />
          {[0,1,2,3].map(i => {
            const t = (progress * 1.4 + i * 0.28) % 1;
            return <circle key={i} cx={52+(i%2)*16} cy={70-t*30} r="2" fill="#fbbf24" opacity={1-t} />;
          })}
        </>
      );
      break;
    case 'chef_signature':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="32" ry="36" fill="none" stroke="#f48fb1" strokeWidth={4} opacity={0.78 + pulse * 0.18} />
          <ellipse cx="60" cy="60" rx="22" ry="26" fill="none" stroke="#fbbf24" strokeWidth={2.5} opacity={0.62} />
          {[0,1,2,3,4].map(i => {
            const a = orbit * 1.2 + i * TAU / 5;
            return <circle key={i} cx={60+Math.cos(a)*34} cy={60+Math.sin(a)*17} r="2.5" fill="#fde68a" opacity={0.85} />;
          })}
        </>
      );
      break;
    case 'master_chosen_strike':
      content = (
        <>
          <path d={`M46 ${72-sweep*3} A24 24 0 0 1 86 48`} fill="none" stroke="#9ca3af" strokeWidth={7} strokeLinecap="round" opacity="0.9" />
          <path d={`M52 ${66-sweep*2} A16 16 0 0 1 80 54`} fill="none" stroke="#f9fafb" strokeWidth={3.5} strokeLinecap="round" opacity="0.82" />
          <circle cx={84} cy={48} r="3.5" fill="#fde68a" opacity="0.9" />
        </>
      );
      break;
    case 'master_chosen_nuke':
      content = (
        <>
          <circle cx="60" cy="60" r="34" fill="none" stroke="#e0e0e0" strokeWidth={4} opacity={0.82 + pulse * 0.14} />
          <circle cx="60" cy="60" r="24" fill="none" stroke="#f9fafb" strokeWidth={2} opacity={0.6} />
          {[0,1,2,3,4,5].map(i => {
            const a = orbit * 0.5 + i * TAU / 6;
            return <circle key={i} cx={60+Math.cos(a)*36} cy={60+Math.sin(a)*36} r="2.5" fill="#fde68a" opacity={0.85} />;
          })}
        </>
      );
      break;
    case 'master_eclipse': {
      const hue = (progress * 0.3) % 1;
      const cycleStroke = hue < 0.33 ? '#d1d5db' : hue < 0.66 ? '#a8dadc' : '#fde68a';
      content = (
        <>
          <ellipse cx="60" cy="60" rx="32" ry="36" fill="none" stroke={cycleStroke} strokeWidth={3.5} opacity={0.72 + pulse * 0.2} />
          <ellipse cx="60" cy="60" rx="22" ry="26" fill="none" stroke="#f9fafb" strokeWidth={1.5} opacity={0.5} />
          {[0,1,2,3,4].map(i => {
            const a = orbit + i * TAU / 5;
            return <circle key={i} cx={60+Math.cos(a)*36} cy={60+Math.sin(a)*18} r="2.5" fill="#e5e7eb" opacity={0.82} />;
          })}
        </>
      );
      break;
    }
    case 'master_apotheosis':
      content = (
        <>
          <ellipse cx="60" cy="60" rx="36" ry="40" fill="#f9fafb" opacity={0.15 + pulse * 0.1} />
          <ellipse cx="60" cy="60" rx="40" ry="44" fill="none" stroke="#e0e0e0" strokeWidth={5} opacity={0.88 + pulse * 0.1} />
          <ellipse cx="60" cy="60" rx="28" ry="32" fill="none" stroke="#fde68a" strokeWidth={2.5} opacity={0.68} />
          <line x1="60" y1="16" x2="60" y2="104" stroke="#f9fafb" strokeWidth={2.5} opacity={0.6} />
          <line x1="16" y1="60" x2="104" y2="60" stroke="#f9fafb" strokeWidth={2.5} opacity={0.6} />
          {[0,1,2,3,4,5].map(i => {
            const t = (progress * 1.2 + i * 0.22) % 1;
            return <circle key={i} cx={52+(i%2)*16} cy={74-t*36} r="2" fill="#fde68a" opacity={1-t} />;
          })}
        </>
      );
      break;
    case 'leper_plague':
      content = (
        <>
          <circle cx="60" cy="60" r={28+pulse*8} fill="#1a2e05" opacity={0.2+pulse*0.1} />
          <circle cx="60" cy="60" r={34+pulse*6} fill="none" stroke="#65a30d" strokeWidth={4} opacity={0.7+pulse*0.25} />
          {[0,1,2,3,4].map(i => {
            const a = orbit*0.8 + i*TAU/5;
            return <circle key={i} cx={60+Math.cos(a)*28} cy={60+Math.sin(a)*16} r="3.5" fill="#a3e635" opacity={0.75} />;
          })}
        </>
      );
      break;
    case 'leper_claw':
      content = (
        <>
          <path d={`M40 ${50+sweep*4} Q55 60 74 ${46-sweep*4}`} fill="none" stroke="#4d7c0f" strokeWidth={5} strokeLinecap="round" opacity="0.9" />
          <path d={`M40 ${62+sweep*3} Q55 70 74 ${58-sweep*3}`} fill="none" stroke="#65a30d" strokeWidth={3} strokeLinecap="round" opacity="0.85" />
          <path d={`M40 ${74+sweep*2} Q55 80 74 ${70-sweep*2}`} fill="none" stroke="#a3e635" strokeWidth={2} strokeLinecap="round" opacity="0.75" />
        </>
      );
      break;
    case 'leper_embrace':
      content = (
        <>
          <ellipse cx="60" cy="60" rx={24+pulse*6} ry={28+pulse*6} fill="#1a2e05" opacity={0.25+pulse*0.1} />
          <ellipse cx="60" cy="60" rx={30+pulse*4} ry={34+pulse*4} fill="none" stroke="#4d7c0f" strokeWidth={3.5} opacity={0.65+pulse*0.3} />
          {[0,1,2,3].map(i => {
            const t = (progress*1.2 + i*0.25) % 1;
            const a = i*TAU/4 + orbit*0.5;
            return <circle key={i} cx={60+Math.cos(a)*(38-t*16)} cy={60+Math.sin(a)*(22-t*10)} r={2.5*(1-t*0.5)} fill="#65a30d" opacity={0.8*(1-t*0.3)} />;
          })}
        </>
      );
      break;
    case 'leper_contagion':
      content = (
        <>
          <circle cx="60" cy="60" r={8+pulse*4} fill="#1a2e05" opacity={0.4+pulse*0.15} />
          {[0,1,2,3,4,5].map(i => {
            const t = (progress*0.7 + i/6) % 1;
            const a = i*TAU/6;
            return <circle key={i} cx={60+Math.cos(a)*t*36} cy={60+Math.sin(a)*t*22} r={2+t*3} fill="#65a30d" opacity={0.9-t*0.6} />;
          })}
        </>
      );
      break;
    case 'leper_tide':
      content = (
        <>
          <circle cx="60" cy="60" r="36" fill="none" stroke="#1a2e05" strokeWidth={10} opacity={0.22+pulse*0.08} />
          <circle cx="60" cy="60" r="36" fill="none" stroke="#4d7c0f" strokeWidth={4} strokeDasharray="18 10" strokeDashoffset={orbit*-30} opacity={0.72+pulse*0.2} />
          <circle cx="60" cy="60" r="24" fill="none" stroke="#65a30d" strokeWidth={2.5} strokeDasharray="10 8" strokeDashoffset={orbit*20} opacity={0.6+pulse*0.25} />
          {[0,1,2].map(i => {
            const a = orbit*1.2 + i*TAU/3;
            return <circle key={i} cx={60+Math.cos(a)*32} cy={60+Math.sin(a)*20} r="3" fill="#a3e635" opacity={0.8} />;
          })}
        </>
      );
      break;
    case 'leper_miasma':
      content = (
        <>
          <ellipse cx="60" cy="60" rx={32+pulse*10} ry={36+pulse*10} fill="#1a2e05" opacity={0.18+pulse*0.1} />
          <ellipse cx="60" cy="60" rx={36+pulse*8} ry={40+pulse*8} fill="none" stroke="#4d7c0f" strokeWidth={5} opacity={0.6+pulse*0.32} />
          <ellipse cx="60" cy="60" rx={22+pulse*6} ry={26+pulse*6} fill="none" stroke="#65a30d" strokeWidth={2.5} opacity={0.5+pulse*0.3} />
          {[0,1,2,3].map(i => (
            <circle key={i} cx={60+Math.cos(orbit*0.8+i*TAU/4)*28} cy={60+Math.sin(orbit*0.8+i*TAU/4)*16} r="2.5" fill="#a3e635" opacity={0.7+pulse*0.2} />
          ))}
        </>
      );
      break;
    default:
      break;
  }

  if (!content) return null;

  return (
    <svg
      viewBox="0 0 120 120"
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      <g transform={`translate(60 60) scale(${overlayScale}) translate(-60 -60)`}>{content}</g>
    </svg>
  );
}

export function AbilityPreview({
  guildId,
  abilityId,
  animationId,
  spriteScale = 1.1,
  vfxScale = 1.35,
  spriteGuildId,
}: Props) {
  const preview = getAbilityPreviewSpec(guildId, abilityId);
  const progress = useLoopProgress(1200);
  const spriteTransform = getSpriteTransform(guildId, preview.effect, progress, spriteScale);
  const tint =
    preview.effect === 'viking_bloodlust'
      ? 'drop-shadow(0 0 16px rgba(220, 38, 38, 0.55)) sepia(1) saturate(6) hue-rotate(-38deg) brightness(0.88)'
      : preview.effect === 'viking_undying_rage'
        ? 'drop-shadow(0 0 18px rgba(127, 29, 29, 0.6)) sepia(1) saturate(4) hue-rotate(-32deg) brightness(0.86)'
        : preview.effect === 'adventurer_adrenaline_rush'
          ? 'drop-shadow(0 0 14px rgba(249,115,22,0.5)) sepia(0.4) saturate(2) hue-rotate(8deg) brightness(1.05)'
          : preview.effect === 'mage_meteor'
            ? 'drop-shadow(0 0 16px rgba(239,68,68,0.55)) sepia(0.6) saturate(3) hue-rotate(-15deg) brightness(0.92)'
            : preview.effect === 'mage_ice_nova'
              ? 'drop-shadow(0 0 12px rgba(147,197,253,0.6)) sepia(0.3) saturate(2) hue-rotate(160deg) brightness(1.08)'
              : preview.effect === 'mage_frostbolt'
                ? 'drop-shadow(0 0 10px rgba(147,197,253,0.55)) sepia(0.2) saturate(2) hue-rotate(170deg) brightness(1.06)'
                : preview.effect === 'mage_arcane_shard'
                  ? 'drop-shadow(0 0 12px rgba(192,132,252,0.6)) sepia(0.4) saturate(3) hue-rotate(220deg) brightness(0.98)'
                  : preview.effect === 'druid_shapeshift'
                ? 'drop-shadow(0 0 12px rgba(76,175,80,0.55)) sepia(0.3) saturate(2) hue-rotate(80deg) brightness(1.06)'
                : preview.effect === 'champion_skullsplitter'
                  ? 'drop-shadow(0 0 16px rgba(220,38,38,0.6)) sepia(0.8) saturate(4) hue-rotate(-20deg) brightness(0.88)'
                  : preview.effect === 'champion_tithe'
                    ? 'drop-shadow(0 0 10px rgba(220,38,38,0.45)) sepia(0.4) saturate(2) hue-rotate(-15deg) brightness(0.95)'
                    : preview.effect === 'prophet_divine'
                      ? 'drop-shadow(0 0 18px rgba(255,255,255,0.7)) brightness(1.15) saturate(0.4)'
                      : preview.effect === 'prophet_curse'
                        ? 'drop-shadow(0 0 12px rgba(124,58,237,0.55)) sepia(0.5) saturate(3) hue-rotate(200deg) brightness(0.9)'
                        : preview.effect === 'vampire_nocturne'
                          ? 'drop-shadow(0 0 16px rgba(122,25,53,0.65)) sepia(0.8) saturate(4) hue-rotate(-25deg) brightness(0.82)'
                          : preview.effect === 'vampire_blood_drain'
                            ? 'drop-shadow(0 0 10px rgba(220,38,38,0.5)) sepia(0.5) saturate(3) hue-rotate(-20deg) brightness(0.9)'
                            : preview.effect === 'darkmage_eternal_night'
                              ? 'drop-shadow(0 0 18px rgba(109,40,217,0.6)) sepia(0.6) saturate(4) hue-rotate(220deg) brightness(0.82)'
                              : preview.effect === 'darkmage_shadow_cloak'
                                ? 'drop-shadow(0 0 12px rgba(74,20,88,0.55)) sepia(0.5) saturate(3) hue-rotate(210deg) brightness(0.78)'
                                : preview.effect === 'cultist_gate'
                                  ? 'drop-shadow(0 0 18px rgba(0,0,0,0.8)) sepia(0.7) saturate(3) hue-rotate(120deg) brightness(0.75)'
                                  : preview.effect === 'master_apotheosis'
                                    ? 'drop-shadow(0 0 16px rgba(249,250,251,0.7)) brightness(1.2) saturate(0.3)'
                                    : preview.effect === 'leper_plague'
                                      ? 'drop-shadow(0 0 14px rgba(101,163,13,0.55)) sepia(0.4) saturate(2) hue-rotate(55deg) brightness(0.96)'
                                      : preview.effect === 'leper_tide'
                                        ? 'drop-shadow(0 0 16px rgba(26,46,5,0.7)) sepia(0.6) saturate(3) hue-rotate(70deg) brightness(0.82)'
                                        : preview.effect === 'leper_contagion'
                                          ? 'drop-shadow(0 0 10px rgba(101,163,13,0.5)) sepia(0.3) saturate(2) hue-rotate(60deg) brightness(1.0)'
                                          : 'none';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '78%',
          height: '78%',
          maxWidth: 180,
          maxHeight: 180,
          aspectRatio: '1 / 1',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `translate(-50%, -50%) ${spriteTransform}`,
            transformOrigin: 'center center',
            filter: tint,
            zIndex: 2,
          }}
        >
          <SpriteStrip guildId={spriteGuildId ?? guildId} animationId={animationId} scale={1} />
        </div>
        <PreviewOverlay effect={preview.effect} progress={progress} scale={vfxScale} />
      </div>
    </div>
  );
}
