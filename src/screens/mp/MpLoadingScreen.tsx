import { useEffect, useRef } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState, MatchPhase } from '@nannymud/shared';
import type { GuildId } from '@nannymud/shared/simulation/types';
import type { StageId } from '../../data/stages';
import { STAGES_BY_ID } from '../../data/stages';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { GUILD_META } from '../../data/guildMeta';
import { TIPS } from '../LoadingScreen';
import { theme, guildAccent, GuildMonogram } from '../../ui';
import { useMatchState } from './useMatchState';
import { usePhaseBounce } from './usePhaseBounce';
import { MpLoading } from './MpLoading';
import { usePreloader } from './usePreloader';

interface Props {
  room: Room<MatchState>;
  onPhaseChange: (phase: MatchPhase) => void;
}

const GRID_LAYOUTS: Record<number, { cols: number; monogram: number }> = {
  2: { cols: 2, monogram: 110 },
  3: { cols: 3, monogram: 90 },
  4: { cols: 2, monogram: 90 },
  5: { cols: 3, monogram: 72 },
  6: { cols: 3, monogram: 72 },
  7: { cols: 4, monogram: 62 },
  8: { cols: 4, monogram: 62 },
};

const TEAM_COLORS: Record<string, string> = {
  A: '#5cf2c2', B: '#ff5d73', C: '#ffb347', D: '#928bff',
};

export function MpLoadingScreen({ room, onPhaseChange }: Props) {
  const state = useMatchState(room);
  const { progress, done } = usePreloader();
  const lastSentRef = useRef(-1);

  usePhaseBounce(state?.phase ?? 'loading', 'loading', onPhaseChange);

  // Forward real preload progress to the server (throttled on Δ ≥ 0.02)
  useEffect(() => {
    if (progress - lastSentRef.current < 0.02 && progress < 1) return;
    lastSentRef.current = progress;
    room.send('load_progress', { value: progress });
  }, [room, progress]);

  // Signal ready once preload is complete — hold for 5 s so the loading screen
  // stays visible while the main Phaser game boots (avoids a black-screen flash).
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => room.send('ready_to_start', {}), 5000);
    return () => clearTimeout(t);
  }, [room, done]);

  if (!state) return <MpLoading />;

  const stageId = (state.stageId || 'assembly') as StageId;
  const stage = STAGES_BY_ID[stageId];
  const accent = `oklch(0.72 0.18 ${stage.hue})`;

  // Build unified tile list: battle uses battleSlots (minus off), versus uses player pair
  interface Tile {
    key: string;
    guildId: GuildId;
    name: string;
    teamColor: string;
    team: string;
    label: string;
    isMe: boolean;
    loadProgress: number;
    isCpu: boolean;
  }

  let tiles: Tile[];

  if (state.gameMode === 'battle') {
    const activeSlots = [...state.battleSlots].filter(s => s.slotType !== 'off');
    let humanIdx = 0;
    tiles = activeSlots.map((slot, i) => {
      const guildId = (slot.guildId || 'adventurer') as GuildId;
      const guild = GUILDS.find(g => g.id === guildId);
      const isCpu = slot.slotType === 'cpu';
      const isMe = slot.ownerSessionId === room.sessionId;
      const label = isCpu ? 'CPU' : (isMe ? 'YOU' : `P${++humanIdx}`);
      const ownerSlot = isCpu ? null : state.players.get(slot.ownerSessionId);
      return {
        key: `${i}`,
        guildId,
        name: guild?.name ?? guildId,
        teamColor: slot.team ? (TEAM_COLORS[slot.team] ?? theme.lineSoft) : theme.lineSoft,
        team: slot.team,
        label,
        isMe,
        loadProgress: isCpu ? 1 : (ownerSlot?.loadProgress ?? 0),
        isCpu,
      };
    });
  } else {
    const allSlots = Array.from(state.players.values());
    const p1Slot = allSlots.find(s => s.sessionId === state.hostSessionId);
    const p2Slot = allSlots.find(s => s.sessionId !== state.hostSessionId);
    tiles = [p1Slot, p2Slot].filter(Boolean).map((p, i) => {
      const guildId = (p!.guildId as GuildId | undefined) ?? 'adventurer';
      const guild = GUILDS.find(g => g.id === guildId);
      const isMe = p!.sessionId === room.sessionId;
      return {
        key: p!.sessionId,
        guildId,
        name: guild?.name ?? guildId,
        teamColor: theme.lineSoft,
        team: '',
        label: isMe ? `P${i + 1} · YOU` : `P${i + 1}`,
        isMe,
        loadProgress: p!.loadProgress,
        isCpu: false,
      };
    });
  }

  const n = Math.max(2, Math.min(8, tiles.length)) as keyof typeof GRID_LAYOUTS;
  const layout = GRID_LAYOUTS[n] ?? GRID_LAYOUTS[8];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: `linear-gradient(180deg, ${accent}18, ${theme.bgDeep} 60%)` }}>
      {/* Header */}
      <div style={{ padding: '18px 32px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 3 }}>NOW LOADING</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 24, color: theme.ink, letterSpacing: '-0.01em', marginTop: 2 }}>{stage.name}</div>
        </div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: accent, letterSpacing: 3 }}>
          {tiles.length} FIGHTERS
        </div>
      </div>

      {/* Tile grid */}
      <div style={{
        flex: 1,
        padding: '20px 24px',
        display: 'grid',
        gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
        gap: 12,
        alignContent: 'center',
        justifyItems: 'stretch',
      }}>
        {tiles.map(tile => {
          const meta = GUILD_META[tile.guildId];
          const slotAccent = guildAccent(meta?.hue ?? 200);
          const barColor = tile.isMe ? accent : slotAccent;

          return (
            <div key={tile.key} style={{
              border: `1px solid ${tile.teamColor}55`,
              background: theme.panel,
              padding: '12px 10px 10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              boxShadow: tile.isMe ? `0 0 0 1px ${accent}66 inset` : 'none',
            }}>
              {/* Slot header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontFamily: theme.fontMono, fontSize: 8, color: tile.isMe ? accent : theme.inkMuted, letterSpacing: 2 }}>
                  {tile.label}
                </span>
                {tile.team && (
                  <span style={{ fontFamily: theme.fontMono, fontSize: 8, color: tile.teamColor, letterSpacing: 2, border: `1px solid ${tile.teamColor}44`, padding: '1px 5px' }}>
                    {tile.team}
                  </span>
                )}
              </div>

              <GuildMonogram guildId={tile.guildId} size={layout.monogram} selected={tile.isMe} />

              <div style={{ fontFamily: theme.fontDisplay, fontSize: 11, color: slotAccent, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                {tile.name}
              </div>

              {/* Per-tile loading bar */}
              <div style={{ width: '100%', height: 3, background: theme.lineSoft, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: barColor,
                  width: `${tile.loadProgress * 100}%`,
                  transition: 'width 200ms ease',
                  boxShadow: tile.isMe ? `0 0 6px ${accent}` : 'none',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer tip */}
      <div style={{ padding: '10px 32px 14px', borderTop: `1px solid ${theme.lineSoft}`, fontFamily: theme.fontBody, fontSize: 12, color: theme.inkDim, fontStyle: 'italic' }}>
        {TIPS[0]}
      </div>
    </div>
  );
}
