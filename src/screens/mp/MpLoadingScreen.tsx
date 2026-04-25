import { useEffect } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState, MatchPhase } from '@nannymud/shared';
import type { GuildId } from '@nannymud/shared/simulation/types';
import type { StageId } from '../../data/stages';
import { STAGES_BY_ID } from '../../data/stages';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { GUILD_META } from '../../data/guildMeta';
import { LoadingScreen, TIPS } from '../LoadingScreen';
import { theme, guildAccent, GuildMonogram } from '../../ui';
import { useMatchState, getMatchSlots } from './useMatchState';
import { usePhaseBounce } from './usePhaseBounce';
import { MpLoading } from './MpLoading';

interface Props {
  room: Room<MatchState>;
  onPhaseChange: (phase: MatchPhase) => void;
}

export function MpLoadingScreen({ room, onPhaseChange }: Props) {
  const state = useMatchState(room);

  usePhaseBounce(state?.phase ?? 'loading', 'loading', onPhaseChange);

  useEffect(() => {
    room.send('ready_to_start', {});
  }, [room]);

  if (!state) return <MpLoading />;

  const stageId = (state.stageId || 'assembly') as StageId;

  // Battle mode: show all active slots in a compact grid
  if (state.gameMode === 'battle') {
    const activeSlots = [...state.battleSlots].filter(s => s.slotType !== 'off');
    const stage = STAGES_BY_ID[stageId];
    const accent = `oklch(0.72 0.18 ${stage.hue})`;
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: `linear-gradient(180deg, ${accent}22, ${theme.bgDeep} 70%)` }}>
        {/* Header */}
        <div style={{ padding: '22px 40px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>NOW LOADING</div>
            <div style={{ fontFamily: theme.fontDisplay, fontSize: 28, color: theme.ink, letterSpacing: '-0.01em', marginTop: 2 }}>{stage.name}</div>
          </div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 3 }}>BATTLE · {activeSlots.length} FIGHTERS</div>
        </div>

        {/* Slot grid */}
        <div style={{ flex: 1, padding: '28px 32px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, overflow: 'auto' }}>
          {activeSlots.map((slot, i) => {
            const guildId = (slot.guildId || 'adventurer') as GuildId;
            const guild = GUILDS.find(g => g.id === guildId);
            const meta = GUILD_META[guildId];
            const slotAccent = guildAccent(meta?.hue ?? 200);
            const teamColor = slot.team ? { A: '#5cf2c2', B: '#ff5d73', C: '#ffb347', D: '#928bff' }[slot.team] ?? theme.lineSoft : theme.lineSoft;
            const label = slot.slotType === 'human' ? (slot.ownerSessionId === room.sessionId ? 'YOU' : `P${i + 1}`) : 'CPU';

            return (
              <div key={i} style={{ border: `1px solid ${teamColor}55`, background: theme.panel, padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>{label}</span>
                  {slot.team && (
                    <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: teamColor, letterSpacing: 2, border: `1px solid ${teamColor}55`, padding: '1px 6px' }}>
                      {slot.team}
                    </span>
                  )}
                </div>
                <GuildMonogram guildId={guildId} size={90} selected={slot.ownerSessionId === room.sessionId} />
                <div style={{ fontFamily: theme.fontDisplay, fontSize: 13, color: slotAccent, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                  {guild?.name ?? guildId}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tip */}
        <div style={{ padding: '14px 40px 20px', borderTop: `1px solid ${theme.lineSoft}`, background: theme.bgDeep }}>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3, marginBottom: 4 }}>▸ ADVICE FROM THE WIZARDS</div>
          <div style={{ fontFamily: theme.fontBody, fontSize: 13, color: theme.inkDim, fontStyle: 'italic' }}>{TIPS[0]}</div>
        </div>
      </div>
    );
  }

  // Versus mode: original 2-player layout
  const { localSlot, opponentSlot } = getMatchSlots(state, room.sessionId);
  const p1 = (localSlot?.guildId as GuildId | undefined) ?? 'adventurer';
  const p2 = (opponentSlot?.guildId as GuildId | undefined) ?? 'knight';

  return <LoadingScreen p1={p1} p2={p2} stageId={stageId} showOpponent />;
}
