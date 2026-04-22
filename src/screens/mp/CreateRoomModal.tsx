import { useEffect, useRef, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState } from '@nannymud/shared';
import { theme, ModalShell } from '../../ui';
import { hostRoom } from '../../game/net/ColyseusClient';

interface Props {
  playerName: string;
  onCancel: () => void;
  onCreated: (room: Room<MatchState>) => void;
}

const ROUNDS_OPTIONS = [1, 3, 5, 7] as const;
type RoundsOption = (typeof ROUNDS_OPTIONS)[number];

export function CreateRoomModal({ playerName, onCancel, onCreated }: Props) {
  const [roomName, setRoomName] = useState('Room');
  const [rounds, setRounds] = useState<RoundsOption>(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const canCreate = roomName.trim().length > 0 && !loading;

  const handleCreate = async () => {
    if (!canCreate) return;
    setLoading(true);
    setError(null);
    try {
      const room = await hostRoom({
        name: roomName.trim(),
        rounds,
        visibility: 'private',
        playerName,
      });
      onCreated(room);
    } catch (err) {
      console.log(err)
      setError(err instanceof Error ? err.message : 'Failed to create room. Check your connection.');
      setLoading(false);
    }
  };

  return (
    <ModalShell
      kicker="MULTIPLAYER"
      title="Create Room"
      onCancel={onCancel}
      primary={{ label: loading ? 'CREATING…' : 'CREATE', onClick: handleCreate, disabled: !canCreate }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Room name */}
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
            ROOM NAME
          </div>
          <input
            ref={inputRef}
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            maxLength={32}
            disabled={loading}
            style={{
              width: '100%',
              background: theme.panel,
              border: `1px solid ${theme.line}`,
              color: theme.ink,
              fontFamily: theme.fontBody,
              fontSize: 16,
              padding: '10px 14px',
              outline: 'none',
              boxSizing: 'border-box',
              opacity: loading ? 0.5 : 1,
            }}
          />
        </div>

        {/* Rounds */}
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
            ROUNDS
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {ROUNDS_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRounds(r)}
                disabled={loading}
                style={{
                  padding: '8px 20px',
                  background: rounds === r ? theme.accent : 'transparent',
                  color: rounds === r ? theme.bgDeep : theme.ink,
                  border: `1px solid ${rounds === r ? theme.accent : theme.line}`,
                  fontFamily: theme.fontMono,
                  fontSize: 15,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  borderRadius: 2,
                  transition: 'all 100ms ease',
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Visibility */}
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
            VISIBILITY
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {/* Private — always selected, only functional option */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontFamily: theme.fontBody,
                fontSize: 14,
                color: theme.ink,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: `2px solid ${theme.accent}`,
                  background: theme.accent,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              Private
            </label>

            {/* Public — visually disabled, coming soon */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'default',
                fontFamily: theme.fontBody,
                fontSize: 14,
                color: theme.inkMuted,
                opacity: 0.45,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: `2px solid ${theme.inkMuted}`,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              Public
              <span
                style={{
                  fontFamily: theme.fontMono,
                  fontSize: 9,
                  letterSpacing: 2,
                  marginLeft: 4,
                }}
              >
                — SOON
              </span>
            </label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              fontFamily: theme.fontMono,
              fontSize: 12,
              color: theme.bad,
              letterSpacing: 1,
              padding: '8px 12px',
              border: `1px solid ${theme.bad}`,
              background: `${theme.bad}18`,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
