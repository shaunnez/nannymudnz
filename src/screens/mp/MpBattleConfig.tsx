import { useCallback, useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState, MatchPhase } from '@nannymud/shared';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import type { GuildId } from '@nannymud/shared/simulation/types';
import { theme, Btn, GuildMonogram } from '../../ui';
import { useMatchState } from './useMatchState';
import { usePhaseBounce } from './usePhaseBounce';
import { MpLoading } from './MpLoading';

interface Props {
  room: Room<MatchState>;
  onLeave: () => void;
  onPhaseChange: (phase: MatchPhase) => void;
}

const TEAM_COLORS: Record<string, string> = {
  A: '#5cf2c2',
  B: '#ff5d73',
  C: '#ffb347',
  D: '#928bff',
};

const GUILD_IDS = GUILDS.map(g => g.id);

export function MpBattleConfig({ room, onLeave, onPhaseChange }: Props) {
  const state = useMatchState(room);
  usePhaseBounce(state?.phase ?? 'battle_config', 'battle_config', onPhaseChange);

  const [takenFlashIdx, setTakenFlashIdx] = useState<number | null>(null);

  const flashTaken = useCallback((index: number) => {
    setTakenFlashIdx(index);
    setTimeout(() => setTakenFlashIdx(null), 800);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onLeave(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onLeave]);

  // Auto-assign default guild to own slot on first load so it can be locked immediately
  useEffect(() => {
    if (!state) return;
    const mySlot = [...state.battleSlots].find(s => s.ownerSessionId === room.sessionId);
    if (mySlot && !mySlot.guildId) {
      room.send('set_my_guild', { guildId: GUILD_IDS[0] });
    }
  // Run once when state first arrives
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!state]);

  if (!state) return <MpLoading />;

  const slots = [...state.battleSlots];
  const isHost = room.sessionId === state.hostSessionId;
  const mySlotIndex = slots.findIndex(s => s.ownerSessionId === room.sessionId);
  const activeSlots = slots.filter(s => s.slotType !== 'off');
  const activeCount = activeSlots.length;
  const allLocked = activeCount >= 2 && activeSlots.every(s => s.locked);
  const canLaunch = isHost && allLocked;

  // Map guildId → slot indices that claim it (for taken indicators)
  const claimsByGuild = new Map<string, number[]>();
  slots.forEach((s, i) => {
    if (s.slotType !== 'off' && s.guildId) {
      const arr = claimsByGuild.get(s.guildId) ?? [];
      arr.push(i);
      claimsByGuild.set(s.guildId, arr);
    }
  });

  const nextGuild = (currentGuildId: string, direction = 1): string => {
    const cur = GUILD_IDS.indexOf(currentGuildId as GuildId);
    const start = cur >= 0 ? cur : 0;
    return GUILD_IDS[(start + direction + GUILD_IDS.length) % GUILD_IDS.length];
  };

  const trySetGuild = (slotIndex: number, guildId: string, sender: 'host' | 'player') => {
    if (state.uniqueGuilds) {
      const takenByOther = [...(claimsByGuild.get(guildId) ?? [])].some(i => i !== slotIndex);
      if (takenByOther) { flashTaken(slotIndex); return; }
    }
    if (sender === 'player') {
      room.send('set_my_guild', { guildId });
    } else {
      const slot = slots[slotIndex];
      room.send('set_battle_slot', { index: slotIndex, slotType: slot.slotType, guildId, team: slot.team });
    }
  };

  const handleCycleType = (index: number) => {
    if (!isHost) return;
    const slot = slots[index];
    if (slot.slotType === 'human') return;
    const next = slot.slotType === 'cpu' ? 'off' : 'cpu';
    room.send('set_battle_slot', { index, slotType: next, guildId: slot.guildId, team: slot.team });
  };

  const handleSetTeam = (index: number, team: string, isOwnSlot: boolean) => {
    if (isOwnSlot) {
      room.send('set_my_team', { team });
    } else if (isHost) {
      const slot = slots[index];
      room.send('set_battle_slot', { index, slotType: slot.slotType, guildId: slot.guildId, team });
    }
  };

  const handleLock = (index: number) => {
    room.send('lock_battle_slot', { index });
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 36px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>BATTLE MODE · CONFIGURE SLOTS</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink }}>Set the field</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={onLeave}>← LEAVE</Btn>
          {isHost && (
            <Btn primary disabled={!canLaunch} onClick={() => room.send('launch_from_config', {})}>
              STAGE →
            </Btn>
          )}
        </div>
      </div>

      {/* 4-column slot grid */}
      <div style={{ flex: 1, padding: '24px 32px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, overflow: 'auto' }}>
        {slots.map((slot, i) => {
          const isOff = slot.slotType === 'off';
          const isHuman = slot.slotType === 'human';
          const isCpu = slot.slotType === 'cpu';
          const isMySlot = i === mySlotIndex;
          const isLocked = slot.locked;
          const teamColor = slot.team ? (TEAM_COLORS[slot.team] ?? theme.lineSoft) : theme.lineSoft;
          const borderColor = isLocked ? theme.good : isMySlot ? theme.accent : isOff ? theme.lineSoft : isHuman ? theme.warn : teamColor;
          const claimers = claimsByGuild.get(slot.guildId) ?? [];

          const canCycleGuild = (isMySlot || (isHost && isCpu)) && !isLocked;
          const canToggleLock = isMySlot || (isHost && isCpu);
          const canEditTeam = isMySlot || (isHost && !isHuman) || (isHost && isCpu);

          const displayGuildId = (slot.guildId || GUILD_IDS[0]) as GuildId;

          return (
            <div
              key={i}
              style={{
                border: `2px solid ${borderColor}`,
                background: isOff ? 'transparent' : isLocked ? `${theme.good}0a` : theme.panel,
                padding: '14px 12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                opacity: isOff ? 0.4 : 1,
                position: 'relative',
                transition: 'border-color 150ms ease, background 150ms ease',
              }}
            >
              {/* Slot header: number + type badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>
                  SLOT {String(i + 1).padStart(2, '0')}
                </span>
                {isHost && !isHuman ? (
                  <span
                    onClick={() => handleCycleType(i)}
                    style={{ cursor: 'pointer', fontFamily: theme.fontMono, fontSize: 12, letterSpacing: 2, color: isOff ? theme.inkMuted : theme.good, border: `1px solid ${isOff ? theme.lineSoft : theme.good}`, padding: '5px 12px' }}
                  >
                    {slot.slotType.toUpperCase()}
                  </span>
                ) : isHuman ? (
                  <span style={{ fontFamily: theme.fontMono, fontSize: 12, letterSpacing: 2, color: theme.warn, border: `1px solid ${theme.warn}55`, padding: '5px 12px' }}>
                    HUMAN
                  </span>
                ) : null}
              </div>

              {/* Guild portrait */}
              {isOff ? (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div
                    onClick={() => isHost && handleCycleType(i)}
                    style={{ width: 110, height: 110, border: `1px dashed ${theme.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2, cursor: isHost ? 'pointer' : 'default' }}
                  >
                    {isHost ? '+ ADD CPU' : 'EMPTY'}
                  </div>
                </div>
              ) : (
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  <div
                    onClick={() => canCycleGuild && trySetGuild(i, nextGuild(displayGuildId), isMySlot ? 'player' : 'host')}
                    style={{ cursor: canCycleGuild ? 'pointer' : 'default', position: 'relative' }}
                  >
                    <GuildMonogram guildId={displayGuildId} size={110} selected={isMySlot} />

                    {/* Locked overlay */}
                    {isLocked && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${theme.good}44`, pointerEvents: 'none' }}>
                        <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.good, letterSpacing: 2, textShadow: `0 1px 4px ${theme.bgDeep}` }}>✓ LOCKED</span>
                      </div>
                    )}

                    {/* Guild taken indicators — always shown */}
                    {claimers.filter(ci => ci !== i).map((claimerIdx, tagI) => {
                      const claimerSlot = slots[claimerIdx];
                      const tagColor = claimerSlot.team ? (TEAM_COLORS[claimerSlot.team] ?? theme.inkMuted) : theme.inkMuted;
                      const isYouClaimer = claimerSlot.ownerSessionId === room.sessionId;
                      const label = claimerSlot.slotType === 'human'
                        ? (isYouClaimer ? 'YOU' : `P${claimerIdx + 1}`)
                        : `CPU${claimerIdx + 1}`;
                      return (
                        <div key={tagI} style={{ position: 'absolute', top: 4 + tagI * 20, right: 4, fontFamily: theme.fontMono, fontSize: 9, color: tagColor, letterSpacing: 1, background: theme.bgDeep, padding: '1px 4px', border: `1px solid ${tagColor}66` }}>
                          ◆ {label}
                        </div>
                      );
                    })}

                    {/* TAKEN flash */}
                    {takenFlashIdx === i && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${theme.bad}cc`, fontFamily: theme.fontMono, fontSize: 13, color: theme.bg, letterSpacing: 2 }}>
                        TAKEN
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Guild name */}
              {!isOff && (
                <>
                  <div style={{ fontFamily: theme.fontDisplay, fontSize: 14, color: isMySlot ? theme.accent : theme.ink, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {GUILDS.find(g => g.id === displayGuildId)?.name ?? '—'}
                  </div>

                  {/* Lock button — always shown for active slots, disabled if not yours */}
                  <button
                    onClick={() => canToggleLock && handleLock(i)}
                    disabled={!canToggleLock}
                    style={{
                      padding: '8px 0',
                      background: isLocked ? theme.good : 'transparent',
                      color: isLocked ? theme.bgDeep : canToggleLock ? theme.ink : theme.inkMuted,
                      border: `1px solid ${isLocked ? theme.good : canToggleLock ? theme.line : theme.lineSoft}`,
                      fontFamily: theme.fontMono,
                      fontSize: 11,
                      letterSpacing: 2,
                      cursor: canToggleLock ? 'pointer' : 'default',
                      transition: 'all 150ms ease',
                      width: '100%',
                      opacity: canToggleLock ? 1 : 0.5,
                    }}
                  >
                    {isLocked ? '✓ LOCKED' : '□ LOCK IN'}
                  </button>

                  {/* Team selector — own slot or host for CPU */}
                  {(isMySlot || (isHost && !isHuman) || (isHost && isCpu)) && (
                    <div>
                      <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2, marginBottom: 4 }}>TEAM</div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {(['', 'A', 'B', 'C', 'D'] as const).map(t => {
                          const active = slot.team === t;
                          const c = t ? (TEAM_COLORS[t] ?? theme.inkMuted) : theme.inkMuted;
                          return (
                            <span
                              key={t}
                              onClick={() => canEditTeam && handleSetTeam(i, t, isMySlot)}
                              style={{ flex: 1, textAlign: 'center', padding: '5px 0', fontFamily: theme.fontMono, fontSize: 10, cursor: canEditTeam ? 'pointer' : 'default', border: `1px solid ${active ? c : theme.lineSoft}`, color: active ? c : theme.inkDim, background: active ? `${c}22` : 'transparent' }}
                            >
                              {t || '—'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 36px', borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', gap: 24, fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>
        <span>TAP PORTRAIT TO CYCLE · LOCK IN TO CONFIRM</span>
        {isHost && <span>TAP TYPE TO TOGGLE CPU/OFF</span>}
        <span style={{ color: allLocked ? theme.good : theme.inkMuted }}>{activeSlots.filter(s => s.locked).length}/{activeCount} LOCKED</span>
      </div>
    </div>
  );
}
