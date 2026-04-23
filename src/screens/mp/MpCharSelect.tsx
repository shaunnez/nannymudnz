import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState, MatchPhase } from '@nannymud/shared';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import type { GuildId, Stats } from '@nannymud/shared/simulation/types';
import { theme, guildAccent, Btn, Chip, GuildMonogram } from '../../ui';
import { GUILD_META } from '../../data/guildMeta';
import { useMatchState, getMatchSlots } from './useMatchState';
import { usePhaseBounce } from './usePhaseBounce';
import { RoomCodeBadge } from './RoomCodeBadge';
import { MpLoading } from './MpLoading';
import { SidePanel, StatBar } from '../CharSelectPanels';
import { GuildDetails } from '../GuildDetails';

interface Props {
  room: Room<MatchState>;
  onLeave: () => void;
  onPhaseChange: (phase: MatchPhase) => void;
}

const COLS = 5;
const ROWS = 3;
const TILE_SIZE = 190;
const TILE_GAP = 20;

export function MpCharSelect({ room, onLeave, onPhaseChange }: Props) {
  const state = useMatchState(room);
  const ids = useMemo(() => GUILDS.map((g) => g.id), []);

  const { localSlot, opponentSlot } = getMatchSlots(state, room.sessionId);

  const isLocked = localSlot?.locked ?? false;

  const [cursorIdx, setCursorIdx] = useState<number>(() => {
    const gid = localSlot?.guildId;
    if (gid) {
      const i = ids.indexOf(gid as GuildId);
      return i >= 0 ? i : 0;
    }
    return 0;
  });

  const [detailsFor, setDetailsFor] = useState<GuildId | null>(null);

  const cursorGuildId = ids[cursorIdx];
  const hoveredMeta = GUILD_META[cursorGuildId];
  const hoveredGuild = GUILDS.find((g) => g.id === cursorGuildId)!;

  usePhaseBounce(state?.phase ?? 'char_select', 'char_select', onPhaseChange);

  const move = useCallback(
    (dx: number, dy: number) => {
      if (isLocked) return;
      setCursorIdx((c) => {
        const r = Math.floor(c / COLS);
        const col = c % COLS;
        const nr = Math.max(0, Math.min(ROWS - 1, r + dy));
        const nc = Math.max(0, Math.min(COLS - 1, col + dx));
        return nr * COLS + nc;
      });
    },
    [isLocked],
  );

  const lockIn = useCallback(() => {
    if (isLocked) return;
    room.send('lock_guild', { guildId: cursorGuildId });
  }, [isLocked, room, cursorGuildId]);

  useEffect(() => {
    if (detailsFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1, 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(0, -1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(0, 1); }
      else if (e.key === 'Enter') { e.preventDefault(); lockIn(); }
      else if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        onLeave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailsFor, lockIn, move, onLeave]);

  if (!state) return <MpLoading />;

  const opponentGuildId = opponentSlot?.locked ? opponentSlot.guildId : null;
  const localGuildId = isLocked ? (localSlot!.guildId as GuildId) : cursorGuildId;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          padding: '20px 36px',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          borderBottom: `1px solid ${theme.lineSoft}`,
          gap: 16,
        }}
      >
        <div style={{ justifySelf: 'start' }}>
          <Btn size="md" onClick={onLeave}>← LEAVE</Btn>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontFamily: theme.fontMono,
              fontSize: 10,
              color: theme.inkMuted,
              letterSpacing: 3,
            }}
          >
            SELECT · {GUILDS.length} GUILDS · MULTIPLAYER
          </span>
          <span
            style={{
              fontFamily: theme.fontDisplay,
              fontSize: 26,
              color: theme.ink,
              textAlign: 'center',
            }}
          >
            Choose your guild
          </span>
        </div>
        <div style={{ justifySelf: 'end', display: 'flex', gap: 8, alignItems: 'center' }}>
          <RoomCodeBadge code={state.code} />
          <Btn size="md" primary disabled={isLocked} onClick={lockIn}>
            {isLocked ? 'LOCKED ✓' : 'LOCK IN →'}
          </Btn>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '280px 1fr 280px',
          overflow: 'hidden',
        }}
      >
        {/* Left panel — local player */}
        <SidePanel
          role="P1"
          roleLabel="P1 · YOU"
          guildId={localGuildId}
          locked={isLocked}
          active={true}
          onView={() => setDetailsFor(localGuildId)}
        />

        {/* Center — guild grid */}
        <div
          style={{
            padding: '28px 36px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            overflow: 'auto',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, ${TILE_SIZE}px)`,
              gap: TILE_GAP,
              justifyContent: 'center',
            }}
          >
            {GUILDS.map((g, i) => {
              const meta = GUILD_META[g.id];
              const acc = guildAccent(meta.hue);
              const isActive = cursorIdx === i;
              const localLockedHere = isLocked && localSlot?.guildId === g.id;
              const oppLockedHere = opponentSlot?.locked && opponentSlot.guildId === g.id;

              return (
                <div
                  key={g.id}
                  onMouseEnter={() => { if (!isLocked) setCursorIdx(i); }}
                  onClick={() => {
                    if (isLocked) return;
                    setCursorIdx(i);
                    room.send('lock_guild', { guildId: g.id });
                  }}
                  style={{
                    position: 'relative',
                    width: TILE_SIZE,
                    cursor: isLocked ? 'default' : 'pointer',
                    outline: isActive ? `2px solid ${acc}` : 'none',
                    outlineOffset: 3,
                  }}
                >
                  <GuildMonogram guildId={g.id} size={TILE_SIZE} selected={isActive} />
                  <div
                    style={{
                      textAlign: 'center',
                      marginTop: 8,
                      fontFamily: theme.fontMono,
                      fontSize: 20,
                      color: isActive ? acc : theme.inkDim,
                      letterSpacing: 2,
                    }}
                  >
                    {g?.name?.toUpperCase()}
                  </div>
                  {localLockedHere && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        fontFamily: theme.fontMono,
                        fontSize: 20,
                        color: theme.accent,
                        letterSpacing: 2,
                        textShadow: `0 0 4px ${theme.bgDeep}`,
                        zIndex: 2,
                      }}
                    >
                      ◆ P1
                    </div>
                  )}
                  {oppLockedHere && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        fontFamily: theme.fontMono,
                        fontSize: 20,
                        color: theme.warn,
                        letterSpacing: 2,
                        textShadow: `0 0 4px ${theme.bgDeep}`,
                        zIndex: 2,
                      }}
                    >
                      ◆ OPP
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Stat strip — always visible, matches SP center strip */}
          <div
            style={{
              marginTop: 'auto',
              padding: '16px 18px',
              border: `1px solid ${theme.lineSoft}`,
              background: theme.panel,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <span
                style={{
                  fontFamily: theme.fontDisplay,
                  fontSize: 20,
                  color: guildAccent(hoveredMeta.hue),
                }}
              >
                {hoveredGuild.name}
              </span>
              <span style={{ marginLeft: 'auto' }}>
                <Chip tone="accent" mono>{hoveredMeta.tag}</Chip>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 30 }}>
              {(Object.entries(hoveredGuild.stats) as [keyof Stats, number][]).map(([k, v]) => (
                <StatBar key={k} label={k} value={v} max={20} hue={hoveredMeta.hue} />
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — opponent */}
        {opponentSlot?.locked && opponentGuildId ? (
          <SidePanel
            role="CPU"
            roleLabel={`P2 · ${opponentSlot.name || 'OPPONENT'}`}
            guildId={opponentGuildId as GuildId}
            locked={true}
            active={false}
            onView={() => setDetailsFor(opponentGuildId as GuildId)}
          />
        ) : (
          <div
            style={{
              padding: 24,
              borderLeft: `1px solid ${theme.lineSoft}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              overflow: 'auto',
            }}
          >
            <div
              style={{
                fontFamily: theme.fontMono,
                fontSize: 14,
                letterSpacing: 3,
                color: theme.inkMuted,
              }}
            >
              {opponentSlot ? 'P2 · OPPONENT' : 'OPP · EMPTY'}
            </div>
            <div
              style={{
                fontFamily: theme.fontBody,
                fontSize: 15,
                color: theme.inkMuted,
                fontStyle: 'italic',
              }}
            >
              {opponentSlot ? 'Opponent is selecting…' : 'Waiting for opponent to join…'}
            </div>
          </div>
        )}
      </div>

      {detailsFor && <GuildDetails guildId={detailsFor} onClose={() => setDetailsFor(null)} />}

      {/* Footer */}
      <div
        style={{
          padding: '10px 36px',
          borderTop: `1px solid ${theme.lineSoft}`,
          display: 'flex',
          gap: 24,
          fontFamily: theme.fontMono,
          fontSize: 10,
          color: theme.inkMuted,
          letterSpacing: 2,
        }}
      >
        <span>◀▶▲▼ MOVE</span>
        <span>↵ LOCK IN</span>
        <span>CLICK INSTANT LOCK</span>
        <span>ESC LEAVE</span>
      </div>
    </div>
  );
}
