import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState } from '@nannymud/shared';
import { theme, Btn } from '../../ui';
import { usePlayerName } from './usePlayerName';
import { CreateRoomModal } from './CreateRoomModal';
import { JoinByCodeModal } from './JoinByCodeModal';
import { usePublicRooms } from './usePublicRooms';
import { joinRoom, type PublicRoom } from '../../game/net/ColyseusClient';

interface Props {
  onBack: () => void;
  onHosted: (room: Room<MatchState>) => void;
  onJoined: (room: Room<MatchState>) => void;
}

type Modal = 'none' | 'create' | 'join';

function formatRounds(n: number): string {
  return `Bo${n}`;
}

export function MpHub({ onBack, onHosted, onJoined }: Props) {
  const [playerName, setPlayerName] = usePlayerName();
  const [modal, setModal] = useState<Modal>('none');
  const [nameInput, setNameInput] = useState(playerName);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const nameReady = playerName.trim().length > 0;
  const { rooms, error: roomsError } = usePublicRooms();

  const commitName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) setPlayerName(trimmed);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const handleJoinPublic = async (room: PublicRoom) => {
    if (!nameReady || joiningRoomId || room.clients >= room.maxClients) return;
    setJoiningRoomId(room.roomId);
    setJoinError(null);
    try {
      const joined = await joinRoom(room.roomId, playerName);
      onJoined(joined);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join room.');
      setJoiningRoomId(null);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '18px 36px',
          borderBottom: `1px solid ${theme.lineSoft}`,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
        }}
      >
        <div style={{ justifySelf: 'start' }}>
          <Btn size="md" onClick={onBack}>← BACK</Btn>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
            MAIN MENU → MULTIPLAYER
          </span>
          <span style={{ fontFamily: theme.fontDisplay, fontSize: 24, color: theme.ink }}>
            ◇ Multiplayer Hub
          </span>
        </div>
        <div />
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 0,
          minHeight: 0,
          padding: '32px 48px 48px',
        }}
      >
        {/* LEFT — actions */}
        <div
          style={{
            flex: '0 0 44%',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            paddingRight: 48,
            borderRight: `1px solid ${theme.lineSoft}`,
          }}
        >
          {/* Player name field */}
          <div>
            <div
              style={{
                fontFamily: theme.fontMono,
                fontSize: 10,
                color: theme.inkMuted,
                letterSpacing: 3,
                marginBottom: 8,
              }}
            >
              YOUR NAME
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitName();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Enter your name…"
                maxLength={24}
                style={{
                  flex: 1,
                  background: theme.panel,
                  border: `1px solid ${nameReady ? theme.accent : theme.warn}`,
                  color: theme.ink,
                  fontFamily: theme.fontBody,
                  fontSize: 16,
                  padding: '10px 14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {!nameReady && (
                <div
                  style={{
                    alignSelf: 'center',
                    fontFamily: theme.fontMono,
                    fontSize: 10,
                    color: theme.warn,
                    letterSpacing: 2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  REQUIRED
                </div>
              )}
            </div>
            {!nameReady && (
              <div
                style={{
                  marginTop: 6,
                  fontFamily: theme.fontMono,
                  fontSize: 10,
                  color: theme.inkMuted,
                  letterSpacing: 1,
                }}
              >
                Set your name to enable hosting and joining rooms.
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => nameReady && setModal('create')}
              disabled={!nameReady}
              style={{
                padding: '18px 24px',
                background: nameReady ? theme.accent : theme.panel,
                color: nameReady ? theme.bgDeep : theme.inkMuted,
                border: `1px solid ${nameReady ? theme.accent : theme.line}`,
                fontFamily: theme.fontMono,
                fontSize: 15,
                letterSpacing: 2,
                textAlign: 'left',
                cursor: nameReady ? 'pointer' : 'not-allowed',
                opacity: nameReady ? 1 : 0.45,
                borderRadius: 2,
                transition: 'all 100ms ease',
              }}
            >
              HOST ROOM
              <div
                style={{
                  fontFamily: theme.fontBody,
                  fontSize: 12,
                  fontWeight: 400,
                  letterSpacing: 0,
                  marginTop: 4,
                  opacity: 0.75,
                }}
              >
                Create a private or public room
              </div>
            </button>

            <button
              onClick={() => nameReady && setModal('join')}
              disabled={!nameReady}
              style={{
                padding: '18px 24px',
                background: 'transparent',
                color: nameReady ? theme.ink : theme.inkMuted,
                border: `1px solid ${nameReady ? theme.line : theme.lineSoft}`,
                fontFamily: theme.fontMono,
                fontSize: 15,
                letterSpacing: 2,
                textAlign: 'left',
                cursor: nameReady ? 'pointer' : 'not-allowed',
                opacity: nameReady ? 1 : 0.45,
                borderRadius: 2,
                transition: 'all 100ms ease',
              }}
            >
              JOIN BY CODE
              <div
                style={{
                  fontFamily: theme.fontBody,
                  fontSize: 12,
                  fontWeight: 400,
                  letterSpacing: 0,
                  marginTop: 4,
                  opacity: 0.75,
                }}
              >
                Enter a 6-character code from the host
              </div>
            </button>
          </div>

        </div>

        {/* RIGHT — public rooms */}
        <div
          style={{
            flex: 1,
            paddingLeft: 48,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <div
            style={{
              fontFamily: theme.fontMono,
              fontSize: 10,
              color: theme.inkMuted,
              letterSpacing: 3,
              marginBottom: 16,
            }}
          >
            PUBLIC ROOMS
          </div>

          {/* Join error */}
          {joinError && (
            <div
              style={{
                marginBottom: 12,
                fontFamily: theme.fontMono,
                fontSize: 11,
                color: theme.bad,
                letterSpacing: 1,
                padding: '6px 10px',
                border: `1px solid ${theme.bad}`,
                background: `${theme.bad}18`,
              }}
            >
              {joinError}
            </div>
          )}

          {/* Room list */}
          <div
            style={{
              flex: 1,
              border: `1px solid ${theme.line}`,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {roomsError ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.fontMono,
                  fontSize: 10,
                  color: theme.bad,
                  letterSpacing: 2,
                  opacity: 0.7,
                }}
              >
                COULD NOT REACH SERVER
              </div>
            ) : rooms.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.fontMono,
                  fontSize: 10,
                  color: theme.inkMuted,
                  letterSpacing: 2,
                  opacity: 0.5,
                }}
              >
                NO PUBLIC ROOMS
              </div>
            ) : (
              rooms.map((room) => {
                const isFull = room.clients >= room.maxClients;
                const isJoining = joiningRoomId === room.roomId;
                const canJoin = nameReady && !isFull && !joiningRoomId;
                return (
                  <button
                    key={room.roomId}
                    onClick={() => handleJoinPublic(room)}
                    disabled={!canJoin}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `1px solid ${theme.lineSoft}`,
                      color: canJoin ? theme.ink : theme.inkMuted,
                      cursor: canJoin ? 'pointer' : 'not-allowed',
                      textAlign: 'left',
                      gap: 12,
                      opacity: canJoin ? 1 : 0.5,
                      transition: 'background 100ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (canJoin) (e.currentTarget as HTMLButtonElement).style.background = theme.panel;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    {/* Room info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: theme.fontMono,
                          fontSize: 13,
                          letterSpacing: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {room.name}
                      </div>
                      <div
                        style={{
                          fontFamily: theme.fontBody,
                          fontSize: 11,
                          color: theme.inkMuted,
                          marginTop: 2,
                        }}
                      >
                        {room.hostName} · {formatRounds(room.rounds)}
                      </div>
                    </div>

                    {/* Slot badge */}
                    <div
                      style={{
                        fontFamily: theme.fontMono,
                        fontSize: 10,
                        letterSpacing: 2,
                        color: isFull ? theme.bad : theme.accent,
                        flexShrink: 0,
                      }}
                    >
                      {isJoining ? '…' : isFull ? 'FULL' : `${room.clients}/2`}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === 'create' && (
        <CreateRoomModal
          playerName={playerName}
          onCancel={() => setModal('none')}
          onCreated={(room) => {
            setModal('none');
            onHosted(room);
          }}
        />
      )}
      {modal === 'join' && (
        <JoinByCodeModal
          playerName={playerName}
          onCancel={() => setModal('none')}
          onJoined={(room) => {
            setModal('none');
            onJoined(room);
          }}
        />
      )}
    </div>
  );
}
