import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import type { SimState, BattleSlot } from '@nannymud/shared/simulation/types';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { theme, GuildMonogram } from '../ui';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from '../game/constants';

interface Props {
  game: Phaser.Game | null;
  slots: BattleSlot[];
}

const TEAM_COLORS: Record<string, string> = {
  A: theme.team1,
  B: theme.team2,
  C: theme.team3,
  D: theme.team4,
};

function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function BattleHUD8({ game, slots }: Props) {
  const stateRef = useRef<SimState | null>(null);
  const [, setTick] = useState(0);
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    if (!frameEl) return;
    const measure = () => {
      const rect = frameEl.getBoundingClientRect();
      if (rect.width > 0) setScale(rect.width / VIRTUAL_WIDTH);
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(frameEl);
    return () => obs.disconnect();
  }, [frameEl]);

  useEffect(() => {
    if (!game) return;
    const onTick = (state: SimState) => {
      stateRef.current = state;
      setTick((n) => (n + 1) & 0xffff);
    };
    game.events.on('sim-tick', onTick);
    return () => { game.events.off('sim-tick', onTick); };
  }, [game]);

  const state = stateRef.current;
  if (!state) return null;

  const activeSlots = slots.filter((s) => s.type !== 'off');
  const top = activeSlots.slice(0, 4);
  const bottom = activeSlots.slice(4, 8);
  const aliveCount = [state.player, ...state.enemies].filter((a) => a.isAlive).length;
  const totalCount = 1 + state.enemies.length;
  const isCritTime = state.battleTimer < 30_000;

  const getActor = (slotIndex: number) => {
    if (slotIndex === 0) return state.player;
    return state.enemies[slotIndex - 1] ?? null;
  };

  return (
    <div
      ref={setFrameEl}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        transform: `scale(${scale})`, transformOrigin: 'top left',
        width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT,
      }}>
        {/* TOP bar */}
        {top.length > 0 && (
          <PlayerBarRow slots={top} slotOffset={0} getActor={getActor} isTop />
        )}

        {/* Centre — timer + alive count */}
        <div style={{
          position: 'absolute',
          top: 44, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <div style={{
            padding: '3px 12px',
            border: `1px solid ${isCritTime ? theme.bad : theme.accent}`,
            background: theme.bgDeep,
            fontFamily: theme.fontMono, fontSize: 20, letterSpacing: 3,
            color: isCritTime ? theme.bad : theme.accent,
          }}>
            {formatTime(state.battleTimer)}
          </div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>
            {aliveCount} / {totalCount} ALIVE
          </div>
        </div>

        {/* BOTTOM bar */}
        {bottom.length > 0 && (
          <PlayerBarRow slots={bottom} slotOffset={4} getActor={getActor} isTop={false} />
        )}
      </div>
    </div>
  );
}

interface BarRowProps {
  slots: BattleSlot[];
  slotOffset: number;
  getActor: (i: number) => import('@nannymud/shared/simulation/types').Actor | null;
  isTop: boolean;
}

function PlayerBarRow({ slots, slotOffset, getActor, isTop }: BarRowProps) {
  return (
    <div style={{
      position: 'absolute',
      top: isTop ? 0 : undefined,
      bottom: isTop ? undefined : 0,
      left: 0, right: 0,
      display: 'grid',
      gridTemplateColumns: `repeat(${slots.length}, 1fr)`,
      gap: 3,
      padding: '5px 8px',
      background: theme.panel,
      borderBottom: isTop ? `1px solid ${theme.line}` : 'none',
      borderTop: isTop ? 'none' : `1px solid ${theme.line}`,
    }}>
      {slots.map((slot, i) => {
        const actor = getActor(i + slotOffset);
        const isHuman = slot.type === 'human';
        const teamColor = slot.team ? TEAM_COLORS[slot.team] : theme.lineSoft;
        const borderColor = isHuman ? theme.accent : teamColor;
        const hpPct = actor ? actor.hp / Math.max(1, actor.hpMax) : 0;
        const mpPct = actor ? actor.mp / Math.max(1, actor.mpMax) : 0;
        const isDead = actor ? !actor.isAlive : true;
        const hpColor = hpPct > 0.35 ? theme.good : hpPct > 0.15 ? theme.warn : theme.bad;

        return (
          <div key={i} style={{
            padding: '4px 5px',
            border: `1px solid ${borderColor}`,
            background: isDead ? `${theme.bad}11` : (isHuman ? `${theme.accent}08` : theme.bgDeep),
            opacity: isDead ? 0.5 : 1,
            display: 'grid', gridTemplateColumns: '26px 1fr', gap: 5,
          }}>
            <GuildMonogram guildId={slot.guildId} size={26} selected={isHuman} dim={isDead} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontFamily: theme.fontMono, fontSize: 8,
                  color: isHuman ? theme.accent : (slot.team ? teamColor : theme.ink),
                  letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {GUILDS.find((g) => g.id === slot.guildId)?.name.slice(0, 7).toUpperCase() ?? slot.guildId}
                </span>
                {isDead && <span style={{ fontFamily: theme.fontMono, fontSize: 7, color: theme.bad, letterSpacing: 1 }}>KO</span>}
              </div>
              <div style={{ marginTop: 2 }}>
                <div style={{ height: 5, background: theme.line, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${hpPct * 100}%`, background: hpColor, transition: 'width 200ms linear' }} />
                </div>
                <div style={{ height: 3, background: theme.line, position: 'relative', overflow: 'hidden', marginTop: 2 }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${mpPct * 100}%`, background: theme.accent, transition: 'width 200ms linear' }} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
