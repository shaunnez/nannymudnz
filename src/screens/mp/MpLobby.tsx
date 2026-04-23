import { useCallback, useEffect, useRef, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState, MatchPhase } from '@nannymud/shared';
import { theme, Btn, Chip } from '../../ui';
import { useMatchState, getMatchSlots } from './useMatchState';
import { usePhaseBounce } from './usePhaseBounce';
import { MpLoading } from './MpLoading';

interface Props {
  room: Room<MatchState>;
  onLeave: () => void;
  onPhaseChange: (phase: MatchPhase) => void;
}

interface ChatMsg {
  name: string;
  text: string;
  sys?: boolean;
  isYou?: boolean;
}

export function MpLobby({ room, onLeave, onPhaseChange }: Props) {
  const state = useMatchState(room);
  usePhaseBounce(state?.phase ?? 'lobby', 'lobby', onPhaseChange);

  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    { name: 'system', text: 'Lobby open — share the room code to invite a friend.', sys: true },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const localNameRef = useRef('');

  useEffect(() => {
    if (!state) return;
    const s = Array.from(state.players.values()).find((p) => p.sessionId === room.sessionId);
    if (s?.name) localNameRef.current = s.name;
  }, [state, room.sessionId]);

  useEffect(() => {
    room.onMessage('chat', (msg: { name: string; text: string }) => {
      setChatMessages((prev) => [
        ...prev.slice(-99),
        { name: msg.name, text: msg.text, isYou: msg.name === localNameRef.current },
      ]);
    });
  }, [room]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Derived state — null-safe so hooks below can use them unconditionally.
  const { localSlot, opponentSlot } = state
    ? getMatchSlots(state, room.sessionId)
    : { localSlot: null, opponentSlot: null };
  const isHost = !!state && room.sessionId === state.hostSessionId;
  const currentReady = localSlot?.ready ?? false;
  const bothPresent = !!localSlot && !!opponentSlot;
  const allReady = bothPresent && !!localSlot?.ready && !!opponentSlot?.ready;
  const canLaunch = isHost && bothPresent && allReady;
  const notReadyCount = [localSlot, opponentSlot].filter((s) => s && !s.ready).length;
  const filledCount = [localSlot, opponentSlot].filter(Boolean).length;

  const copyCode = useCallback(() => {
    if (state?.code) navigator.clipboard?.writeText(state.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [state?.code]);

  const sendChat = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = chatInput.trim();
      if (!text) return;
      room.send('chat', { text });
      setChatInput('');
    },
    [chatInput, room],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inChat = document.activeElement === chatInputRef.current;
      if (e.key === 'Escape') { e.preventDefault(); onLeave(); return; }
      if (inChat) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        room.send('ready_toggle', { ready: !currentReady });
      } else if (e.key === 'Enter' && canLaunch) {
        e.preventDefault();
        room.send('launch_battle', {});
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canLaunch, currentReady, onLeave, room]);

  if (!state) return <MpLoading />;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 32px',
          borderBottom: `1px solid ${theme.lineSoft}`,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: theme.fontMono,
              fontSize: 10,
              color: theme.inkMuted,
              letterSpacing: 3,
            }}
          >
            ROOM LOBBY · PRE-GAME · {filledCount}/2
          </div>
          <div
            style={{
              fontFamily: theme.fontDisplay,
              fontSize: 26,
              color: theme.ink,
              letterSpacing: '-0.01em',
            }}
          >
            {state.name || 'Untitled Room'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              fontFamily: theme.fontMono,
              fontSize: 9,
              color: theme.inkMuted,
              letterSpacing: 2,
            }}
          >
            CODE
          </div>
          <div
            onClick={copyCode}
            style={{
              cursor: 'pointer',
              padding: '8px 14px',
              background: theme.bgDeep,
              border: `1px solid ${theme.accent}`,
              color: theme.accent,
              fontFamily: theme.fontMono,
              fontSize: 18,
              letterSpacing: 6,
            }}
          >
            #{state.code}
          </div>
          <span
            style={{
              fontFamily: theme.fontMono,
              fontSize: 9,
              color: copied ? theme.good : theme.inkMuted,
              letterSpacing: 2,
              width: 62,
            }}
          >
            {copied ? 'COPIED ✓' : 'CLICK·COPY'}
          </span>
        </div>
        <Btn size="md" onClick={onLeave}>← LEAVE</Btn>
      </div>

      {/* Meta strip */}
      <div
        style={{
          padding: '10px 32px',
          borderBottom: `1px solid ${theme.lineSoft}`,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <Chip tone="accent" mono>1V1</Chip>
        <Chip mono>BO{state.rounds}</Chip>
        <Chip mono>{state.visibility.toUpperCase()}</Chip>
      </div>

      {/* Body — two columns */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1.7fr 1fr',
          overflow: 'hidden',
        }}
      >
        {/* Left: slot cards + footer */}
        <div
          style={{
            padding: 24,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              fontFamily: theme.fontMono,
              fontSize: 10,
              color: theme.accent,
              letterSpacing: 3,
            }}
          >
            ▸ PLAYERS
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SlotCard
              slot={localSlot ?? null}
              isYou
              showHost={isHost}
              showKick={false}
              slotIndex={0}
            />
            <SlotCard
              slot={opponentSlot ?? null}
              isYou={false}
              showHost={!isHost && !!opponentSlot && opponentSlot.sessionId === state.hostSessionId}
              showKick={isHost && !!opponentSlot}
              onKick={() => opponentSlot && room.send('kick', { sessionId: opponentSlot.sessionId })}
              slotIndex={1}
            />
          </div>

          {/* Footer actions */}
          <div
            style={{
              marginTop: 'auto',
              paddingTop: 16,
              borderTop: `1px solid ${theme.lineSoft}`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                flex: 1,
                fontFamily: theme.fontMono,
                fontSize: 10,
                color: theme.inkMuted,
                letterSpacing: 2,
              }}
            >
              {allReady ? '▸ ALL PLAYERS READY' : `▸ WAITING FOR ${notReadyCount} PLAYER(S)`}
            </div>
            <Btn size="md" onClick={() => room.send('ready_toggle', { ready: !currentReady })}>
              {currentReady ? '■ READY' : '□ READY UP'}
            </Btn>
            {isHost && (
              <Btn
                size="md"
                primary
                disabled={!canLaunch}
                onClick={() => room.send('launch_battle', {})}
              >
                LAUNCH BATTLE →
              </Btn>
            )}
          </div>
        </div>

        {/* Right: chat */}
        <div
          style={{
            borderLeft: `1px solid ${theme.lineSoft}`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${theme.lineSoft}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontFamily: theme.fontMono,
                fontSize: 10,
                color: theme.accent,
                letterSpacing: 3,
              }}
            >
              ▸ LOBBY CHAT
            </span>
            <span
              style={{
                fontFamily: theme.fontMono,
                fontSize: 9,
                color: theme.inkMuted,
                letterSpacing: 2,
              }}
            >
              {chatMessages.length} msg
            </span>
          </div>
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '12px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontFamily: theme.fontMono,
              fontSize: 12,
            }}
          >
            {chatMessages.map((m, i) => (
              <div
                key={i}
                style={{
                  color: m.sys ? theme.inkMuted : theme.inkDim,
                  fontStyle: m.sys ? 'italic' : 'normal',
                }}
              >
                {!m.sys && (
                  <span style={{ color: m.isYou ? theme.accent : theme.ink }}>
                    &lt;{m.name}&gt;{' '}
                  </span>
                )}
                {m.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form
            onSubmit={sendChat}
            style={{
              padding: 12,
              borderTop: `1px solid ${theme.lineSoft}`,
              display: 'flex',
              gap: 6,
            }}
          >
            <input
              ref={chatInputRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="say something…"
              style={{
                flex: 1,
                padding: '8px 10px',
                background: theme.bgDeep,
                border: `1px solid ${theme.line}`,
                color: theme.ink,
                fontFamily: theme.fontMono,
                fontSize: 12,
                outline: 'none',
                borderRadius: 2,
              }}
            />
            <Btn size="sm">SEND</Btn>
          </form>
        </div>
      </div>

      {/* Keyboard hints */}
      <div
        style={{
          padding: '8px 32px',
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
// SlotCard
// ---------------------------------------------------------------------------

interface SlotCardProps {
  slot: {
    name: string;
    sessionId: string;
    ready: boolean;
    ping: number;
    connected: boolean;
  } | null;
  isYou: boolean;
  showHost: boolean;
  showKick: boolean;
  onKick?: () => void;
  slotIndex: number;
}

function SlotCard({ slot, isYou, showHost, showKick, onKick, slotIndex }: SlotCardProps) {
  const avatarColor = isYou ? theme.accent : theme.warn;

  if (!slot) {
    return (
      <div
        style={{
          padding: 14,
          border: `1px dashed ${theme.line}`,
          color: theme.inkMuted,
          fontFamily: theme.fontMono,
          fontSize: 11,
          letterSpacing: 2,
          textAlign: 'center',
          minHeight: 84,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div>EMPTY SLOT · WAITING…</div>
        <div
          style={{
            fontSize: 10,
            color: theme.inkMuted,
            fontStyle: 'italic',
            fontFamily: theme.fontBody,
          }}
        >
          Share the room code to invite a friend
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 10,
        border: `1px solid ${isYou ? `${theme.accent}55` : theme.line}`,
        background: isYou ? `${theme.accent}0a` : theme.panel,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 12,
        alignItems: 'center',
        minHeight: 84,
        borderRadius: 2,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: `${avatarColor}22`,
          border: `2px solid ${avatarColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.fontDisplay,
          fontSize: 22,
          color: avatarColor,
          flexShrink: 0,
        }}
      >
        {slot.name.slice(0, 1).toUpperCase() || '?'}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: theme.fontDisplay, fontSize: 15, color: theme.ink }}>
            {slot.name}
          </span>
          {isYou && <Tag color={theme.accent}>YOU</Tag>}
          {showHost && <Tag color={theme.warn}>HOST</Tag>}
        </div>
        <div
          style={{
            fontFamily: theme.fontMono,
            fontSize: 9,
            color: theme.inkMuted,
            letterSpacing: 1,
            marginTop: 3,
          }}
        >
          {slot.ping}ms · slot {String(slotIndex + 1).padStart(2, '0')}
        </div>
        {!slot.connected && (
          <div
            style={{
              fontFamily: theme.fontMono,
              fontSize: 9,
              color: theme.bad,
              letterSpacing: 2,
              marginTop: 3,
            }}
          >
            RECONNECTING…
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span
          style={{
            fontFamily: theme.fontMono,
            fontSize: 10,
            letterSpacing: 2,
            color: slot.ready ? theme.good : theme.inkMuted,
            border: `1px solid ${slot.ready ? theme.good : theme.lineSoft}`,
            padding: '2px 8px',
          }}
        >
          {slot.ready ? '■ READY' : '□ WAIT'}
        </span>
        {showKick && onKick && (
          <span
            onClick={onKick}
            style={{
              cursor: 'pointer',
              fontFamily: theme.fontMono,
              fontSize: 9,
              color: theme.inkMuted,
              letterSpacing: 2,
              opacity: 0.6,
            }}
          >
            [ KICK ]
          </span>
        )}
      </div>
    </div>
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
