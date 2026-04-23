import { useEffect, useState } from 'react';
import type { GuildId } from '@nannymud/shared/simulation/types';
import { SpriteStrip } from './SpriteStrip';

interface Props {
  guildId: GuildId;
  abilityId: string;
  animationId: string;
  spriteScale?: number;
  vfxScale?: number;
}

type PreviewEffect =
  | 'viking_whirlwind'
  | 'viking_harpoon'
  | 'viking_bloodlust'
  | 'viking_axe_swing'
  | 'viking_undying_rage'
  | 'viking_shield_bash';

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
}: Props) {
  const preview = getAbilityPreviewSpec(guildId, abilityId);
  const progress = useLoopProgress(1200);
  const spriteTransform = getSpriteTransform(guildId, preview.effect, progress, spriteScale);
  const tint =
    preview.effect === 'viking_bloodlust'
      ? 'drop-shadow(0 0 16px rgba(220, 38, 38, 0.55)) sepia(1) saturate(6) hue-rotate(-38deg) brightness(0.88)'
      : preview.effect === 'viking_undying_rage'
        ? 'drop-shadow(0 0 18px rgba(127, 29, 29, 0.6)) sepia(1) saturate(4) hue-rotate(-32deg) brightness(0.86)'
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
          <SpriteStrip guildId={guildId} animationId={animationId} scale={1} />
        </div>
        <PreviewOverlay effect={preview.effect} progress={progress} scale={vfxScale} />
      </div>
    </div>
  );
}
