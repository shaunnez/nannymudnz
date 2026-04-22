import type { Room } from '@colyseus/sdk';
import type { MatchState, MatchPhase } from '@nannymud/shared';
import { theme, Btn } from '../../ui';
import { useMatchState, getMatchSlots } from './useMatchState';
import { usePhaseBounce } from './usePhaseBounce';
import { RoomCodeBadge } from './RoomCodeBadge';
import { MpLoading } from './MpLoading';

interface Props {
  room: Room<MatchState>;
  onLeave: () => void;
  onPhaseChange: (phase: MatchPhase) => void;
}

export function MpLobby({ room, onLeave, onPhaseChange }: Props) {
  const state = useMatchState(room);

  usePhaseBounce(state?.phase ?? 'lobby', 'lobby', onPhaseChange);

  if (!state) return <MpLoading />;

  const { slots, localSlot, opponentSlot } = getMatchSlots(state, room.sessionId);

  const isHost = room.sessionId === state.hostSessionId;
  const currentReady = localSlot?.ready ?? false;
  const bothPresent = slots.length === 2;
  const bothReady = bothPresent && slots.every((s) => s.ready);
  const canLaunch = isHost && bothPresent && bothReady;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
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
            MULTIPLAYER · LOBBY
          </span>
          <span
            style={{
              fontFamily: theme.fontDisplay,
              fontSize: 26,
              color: theme.ink,
              textAlign: 'center',
            }}
          >
            {state?.name || 'Waiting Room'}
          </span>
        </div>
        <div style={{ justifySelf: 'end' }}>
          <RoomCodeBadge code={state.code} />
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 48,
          padding: '48px 64px',
        }}
      >
        {/* Player slot — local */}
        <PlayerSlotCard
          name={localSlot?.name ?? ''}
          isYou
          isHost={isHost}
          ready={localSlot?.ready ?? false}
          connected={localSlot?.connected ?? true}
          empty={!localSlot}
        />

        {/* VS divider */}
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 48,
            color: theme.inkMuted,
            letterSpacing: 4,
            flexShrink: 0,
          }}
        >
          VS
        </div>

        {/* Player slot — opponent */}
        <PlayerSlotCard
          name={opponentSlot?.name ?? ''}
          isYou={false}
          isHost={!isHost && !!opponentSlot && opponentSlot.sessionId === state.hostSessionId}
          ready={opponentSlot?.ready ?? false}
          connected={opponentSlot?.connected ?? true}
          empty={!opponentSlot}
        />
      </div>

      {/* Action bar */}
      <div
        style={{
          padding: '20px 36px',
          borderTop: `1px solid ${theme.lineSoft}`,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Ready toggle */}
        <ReadyBtn
          ready={currentReady}
          onToggle={() => room.send('ready_toggle', { ready: !currentReady })}
        />

        {/* Launch — host only */}
        {isHost && (
          <button
            onClick={() => { if (canLaunch) room.send('launch_battle', {}); }}
            disabled={!canLaunch}
            style={{
              padding: '12px 32px',
              background: canLaunch ? theme.accent : theme.panel,
              color: canLaunch ? theme.bgDeep : theme.inkMuted,
              border: `1px solid ${canLaunch ? theme.accent : theme.line}`,
              fontFamily: theme.fontMono,
              fontSize: 14,
              letterSpacing: 3,
              cursor: canLaunch ? 'pointer' : 'not-allowed',
              opacity: canLaunch ? 1 : 0.45,
              borderRadius: 2,
              transition: 'all 100ms ease',
            }}
          >
            LAUNCH BATTLE →
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Hint */}
        <div
          style={{
            fontFamily: theme.fontMono,
            fontSize: 10,
            color: theme.inkMuted,
            letterSpacing: 2,
          }}
        >
          {!bothPresent
            ? 'Waiting for opponent…'
            : !bothReady
            ? 'Both players must be ready'
            : isHost
            ? 'All ready — launch when set!'
            : 'Waiting for host to launch…'}
        </div>
      </div>

      {/* Keyboard hints */}
      <div
        style={{
          padding: '8px 36px',
          borderTop: `1px solid ${theme.lineSoft}`,
          display: 'flex',
          gap: 24,
          fontFamily: theme.fontMono,
          fontSize: 10,
          color: theme.inkMuted,
          letterSpacing: 2,
        }}
      >
        <span>R READY</span>
        {isHost && <span>ENTER LAUNCH</span>}
        <span>ESC LEAVE</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PlayerSlotCardProps {
  name: string;
  isYou: boolean;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  empty: boolean;
}

function PlayerSlotCard({ name, isYou, isHost, ready, connected, empty }: PlayerSlotCardProps) {
  const readyColor = ready ? theme.good : theme.warn;

  return (
    <div
      style={{
        flex: '0 0 280px',
        padding: 28,
        border: `1px solid ${ready ? theme.good + '55' : theme.lineSoft}`,
        background: theme.panel,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: 'center',
        transition: 'border-color 200ms ease',
      }}
    >
      {empty ? (
        <>
          <div
            style={{
              width: 72,
              height: 72,
              border: `2px dashed ${theme.line}`,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.inkMuted,
              fontFamily: theme.fontDisplay,
              fontSize: 28,
            }}
          >
            ?
          </div>
          <div
            style={{
              fontFamily: theme.fontMono,
              fontSize: 11,
              color: theme.inkMuted,
              letterSpacing: 3,
              textAlign: 'center',
            }}
          >
            EMPTY SLOT
          </div>
          <div
            style={{
              fontFamily: theme.fontBody,
              fontSize: 12,
              color: theme.inkMuted,
              textAlign: 'center',
              fontStyle: 'italic',
            }}
          >
            Share the room code to invite a friend
          </div>
        </>
      ) : (
        <>
          {/* Avatar placeholder */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: isYou ? `${theme.accent}22` : `${theme.warn}22`,
              border: `2px solid ${isYou ? theme.accent : theme.warn}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.fontDisplay,
              fontSize: 28,
              color: isYou ? theme.accent : theme.warn,
            }}
          >
            {name.slice(0, 1).toUpperCase() || '?'}
          </div>

          {/* Name + tags */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: theme.fontDisplay,
                fontSize: 20,
                color: theme.ink,
                letterSpacing: '-0.01em',
              }}
            >
              {name}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 6,
                justifyContent: 'center',
                marginTop: 6,
                flexWrap: 'wrap',
              }}
            >
              {isYou && (
                <Tag color={theme.accent}>YOU</Tag>
              )}
              {isHost && (
                <Tag color={theme.warn}>HOST</Tag>
              )}
            </div>
          </div>

          {/* Connection status */}
          {!connected && (
            <div
              style={{
                fontFamily: theme.fontMono,
                fontSize: 10,
                color: theme.bad,
                letterSpacing: 2,
                padding: '4px 10px',
                border: `1px solid ${theme.bad}55`,
                background: `${theme.bad}18`,
              }}
            >
              DISCONNECTED — WAITING…
            </div>
          )}

          {/* Ready badge */}
          <div
            style={{
              fontFamily: theme.fontMono,
              fontSize: 12,
              color: readyColor,
              letterSpacing: 3,
              padding: '6px 18px',
              border: `1px solid ${readyColor}55`,
              background: `${readyColor}12`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>{ready ? '✓' : '○'}</span>
            <span>{ready ? 'READY' : 'NOT READY'}</span>
          </div>
        </>
      )}
    </div>
  );
}

interface ReadyBtnProps {
  ready: boolean;
  onToggle: () => void;
}

function ReadyBtn({ ready, onToggle }: ReadyBtnProps) {
  return (
    <button
      onClick={onToggle}
      style={{
        padding: '12px 28px',
        background: ready ? `${theme.good}22` : theme.panel,
        color: ready ? theme.good : theme.ink,
        border: `1px solid ${ready ? theme.good : theme.line}`,
        fontFamily: theme.fontMono,
        fontSize: 14,
        letterSpacing: 3,
        cursor: 'pointer',
        borderRadius: 2,
        transition: 'all 120ms ease',
      }}
    >
      {ready ? '✓ READY' : '○ NOT READY'}
    </button>
  );
}

interface TagProps {
  color: string;
  children: string;
}

function Tag({ color, children }: TagProps) {
  return (
    <span
      style={{
        fontFamily: theme.fontMono,
        fontSize: 9,
        letterSpacing: 2,
        color,
        padding: '2px 6px',
        border: `1px solid ${color}55`,
        background: `${color}12`,
      }}
    >
      {children}
    </span>
  );
}
