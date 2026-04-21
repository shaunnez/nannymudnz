import { useEffect, useMemo, useState } from 'react';
import { GUILDS } from '../simulation/guildData';
import type { GuildId } from '../simulation/types';
import { GUILD_META } from '../data/guildMeta';
import { STAGES_BY_ID } from '../data/stages';
import type { StageId } from '../data/stages';
import { theme, guildAccent, GuildMonogram } from '../ui';

interface Props {
  p1: GuildId;
  p2: GuildId;
  stageId: StageId;
  onDone: () => void;
  showOpponent?: boolean;
}

const TIPS = [
  'Depth (↑↓) is your dodge axis — step past an attack instead of blocking it.',
  'Hold K to block; release into J to counter. Frames favor the reader.',
  'Double-tap a direction to run. Stamina does not care about your opinion.',
  'Combo strings live in your guild — ↓↓J, →→J, ↓↑J, ←→J, ↓↑↓↑J.',
  'RMB (K+J) utility is specific per guild. Read the Move List once, use it forever.',
  'Jump cancels out of recovery. Timing beats mashing.',
  'Bosses rotate phases on HP thresholds. Watch the ring, not the bar.',
  'Crowd control eats resource. Spend where it ends fights, not starts them.',
];

const P1_DURATION = 2200;
const PER_PLAYER = 450;

export function LoadingScreen({ p1, p2, stageId, onDone, showOpponent = true }: Props) {
  const stage = STAGES_BY_ID[stageId];
  const accent = `oklch(0.72 0.18 ${stage.hue})`;
  const p1Meta = GUILD_META[p1];
  const p2Meta = GUILD_META[p2];
  const p1Guild = useMemo(() => GUILDS.find((g) => g.id === p1)!, [p1]);
  const p2Guild = useMemo(() => GUILDS.find((g) => g.id === p2)!, [p2]);
  const p1Accent = guildAccent(p1Meta.hue);
  const p2Accent = guildAccent(p2Meta.hue);

  const [p1Progress, setP1Progress] = useState(0);
  const [p2Progress, setP2Progress] = useState(0);
  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * TIPS.length));

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const p1Pct = Math.min(1, elapsed / P1_DURATION);
      const p2Delay = PER_PLAYER;
      const p2Pct = showOpponent ? Math.min(1, Math.max(0, elapsed - p2Delay) / P1_DURATION) : 0;
      setP1Progress(p1Pct);
      setP2Progress(p2Pct);
      const done = p1Pct >= 1 && (!showOpponent || p2Pct >= 1);
      if (done) {
        onDone();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone, showOpponent]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTipIdx((i) => (i + 1) % TIPS.length);
    }, 1400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: `linear-gradient(180deg, ${accent}22, ${theme.bgDeep} 70%)`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `repeating-linear-gradient(135deg, transparent 0 22px, ${accent}12 22px 23px)`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          padding: '22px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          borderBottom: `1px solid ${theme.lineSoft}`,
          position: 'relative',
        }}
      >
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
            NOW LOADING
          </div>
          <div
            style={{
              fontFamily: theme.fontDisplay,
              fontSize: 28,
              color: theme.ink,
              letterSpacing: '-0.01em',
              marginTop: 2,
            }}
          >
            {stage.name}
          </div>
        </div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 3 }}>
          HUE · {stage.hue}°
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: showOpponent ? '1fr 1fr' : '1fr',
          gap: 0,
          position: 'relative',
        }}
      >
        <PlayerLoadPanel
          role="P1"
          guildName={p1Guild.name}
          guildTag={p1Meta.tag}
          guildId={p1}
          accent={p1Accent}
          progress={p1Progress}
          side="L"
          showDivider={showOpponent}
        />
        {showOpponent && (
          <PlayerLoadPanel
            role="CPU"
            guildName={p2Guild.name}
            guildTag={p2Meta.tag}
            guildId={p2}
            accent={p2Accent}
            progress={p2Progress}
            side="R"
            showDivider={false}
          />
        )}
      </div>

      <div
        style={{
          position: 'relative',
          padding: '16px 40px 22px',
          borderTop: `1px solid ${theme.lineSoft}`,
          background: theme.bgDeep,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
          ▸ ADVICE FROM THE WIZARDS
        </div>
        <div
          key={tipIdx}
          style={{
            fontFamily: theme.fontBody,
            fontSize: 14,
            color: theme.inkDim,
            fontStyle: 'italic',
            lineHeight: 1.55,
          }}
        >
          {TIPS[tipIdx]}
        </div>
      </div>
    </div>
  );
}

interface PanelProps {
  role: 'P1' | 'CPU';
  guildName: string;
  guildTag: string;
  guildId: GuildId;
  accent: string;
  progress: number;
  side: 'L' | 'R';
  showDivider: boolean;
}

function PlayerLoadPanel({ role, guildName, guildTag, guildId, accent, progress, side, showDivider }: PanelProps) {
  const left = side === 'L';
  const pct = Math.round(progress * 100);
  const ready = progress >= 1;
  return (
    <div
      style={{
        padding: '40px 44px',
        borderRight: showDivider && left ? `1px solid ${theme.lineSoft}` : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        alignItems: left ? 'flex-start' : 'flex-end',
        textAlign: left ? 'left' : 'right',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: left ? 'row' : 'row-reverse',
          gap: 10,
          alignItems: 'baseline',
          width: '100%',
          justifyContent: left ? 'flex-start' : 'flex-end',
        }}
      >
        <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: accent, letterSpacing: 4 }}>{role}</span>
        <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: ready ? theme.good : theme.warn, letterSpacing: 3 }}>
          {ready ? 'READY' : 'LOADING…'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: left ? 'row' : 'row-reverse', alignItems: 'center', gap: 18 }}>
        <GuildMonogram guildId={guildId} size={128} selected={ready} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: left ? 'left' : 'right' }}>
          <div
            style={{
              fontFamily: theme.fontDisplay,
              fontSize: 34,
              color: theme.ink,
              letterSpacing: '-0.01em',
              lineHeight: 1.05,
            }}
          >
            {guildName}
          </div>
          <div
            style={{
              fontFamily: theme.fontMono,
              fontSize: 11,
              color: theme.inkDim,
              letterSpacing: 2,
            }}
          >
            {guildTag.toUpperCase()}
          </div>
        </div>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: left ? 'row' : 'row-reverse',
            justifyContent: 'space-between',
            fontFamily: theme.fontMono,
            fontSize: 10,
            color: theme.inkMuted,
            letterSpacing: 2,
          }}
        >
          <span>PROGRESS</span>
          <span style={{ color: ready ? accent : theme.ink }}>{pct}%</span>
        </div>
        <div
          style={{
            width: '100%',
            height: 10,
            background: theme.bgDeep,
            border: `1px solid ${theme.lineSoft}`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: left ? 0 : undefined,
              right: left ? undefined : 0,
              width: `${pct}%`,
              background: accent,
              transition: 'width 80ms linear',
            }}
          />
        </div>
      </div>
    </div>
  );
}
