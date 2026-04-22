import { useEffect, useState } from 'react';
import type { Room } from 'colyseus.js';
import type { MatchState } from '@nannymud/shared';
import { theme, Btn } from '../../ui';
import { usePlayerName } from './usePlayerName';
import { CreateRoomModal } from './CreateRoomModal';
import { JoinByCodeModal } from './JoinByCodeModal';

interface Props {
  onBack: () => void;
  onHosted: (room: Room<MatchState>) => void;
  onJoined: (room: Room<MatchState>) => void;
}

type Modal = 'none' | 'create' | 'join';

export function MpHub({ onBack, onHosted, onJoined }: Props) {
  const [playerName, setPlayerName] = usePlayerName();
  const [modal, setModal] = useState<Modal>('none');
  const [nameInput, setNameInput] = useState(playerName);

  const nameReady = playerName.trim().length > 0;

  // Sync nameInput → playerName on blur/Enter
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
          padding: '52px 48px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div
          style={{
            fontFamily: theme.fontMono,
            fontSize: 10,
            color: theme.inkMuted,
            letterSpacing: 3,
          }}
        >
          MAIN MENU → MULTIPLAYER
        </div>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 36,
            color: theme.ink,
            letterSpacing: '-0.02em',
          }}
        >
          ◇ MULTIPLAYER HUB
        </div>
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
                Create a private room and invite a friend by code
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

          {/* Back button */}
          <div style={{ marginTop: 'auto' }}>
            <Btn onClick={onBack}>← BACK</Btn>
          </div>
        </div>

        {/* RIGHT — public rooms (coming soon) */}
        <div
          style={{
            flex: 1,
            paddingLeft: 48,
            display: 'flex',
            flexDirection: 'column',
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

          <div
            style={{
              flex: 1,
              border: `1px dashed ${theme.line}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              opacity: 0.4,
            }}
          >
            <div
              style={{
                fontFamily: theme.fontDisplay,
                fontSize: 18,
                color: theme.ink,
                letterSpacing: '0.02em',
              }}
            >
              Public rooms
            </div>
            <div
              style={{
                fontFamily: theme.fontMono,
                fontSize: 10,
                color: theme.inkMuted,
                letterSpacing: 2,
              }}
            >
              — COMING SOON —
            </div>
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
