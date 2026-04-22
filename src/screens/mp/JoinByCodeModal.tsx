import { useEffect, useRef, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState } from '@nannymud/shared';
import { theme, ModalShell } from '../../ui';
import { joinByCode } from '../../game/net/ColyseusClient';

interface Props {
  playerName: string;
  onCancel: () => void;
  onJoined: (room: Room<MatchState>) => void;
}

const CODE_LENGTH = 6;
const ALLOWED_CHARS = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');

function toAllowed(char: string): string {
  const up = char.toUpperCase();
  return ALLOWED_CHARS.has(up) ? up : '';
}

export function JoinByCodeModal({ playerName, onCancel, onJoined }: Props) {
  const [cells, setCells] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(CODE_LENGTH).fill(null));

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const code = cells.join('');
  const canJoin = code.length === CODE_LENGTH && cells.every((c) => ALLOWED_CHARS.has(c)) && !loading;

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (cells[index] !== '') {
        // Clear current cell
        setCells((prev) => {
          const next = [...prev];
          next[index] = '';
          return next;
        });
      } else if (index > 0) {
        // Move to previous and clear
        setCells((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter' && canJoin) {
      handleJoin();
    }
  };

  const handleInput = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw) return;
    // Accept potentially multiple chars pasted in
    const filtered = raw.split('').map(toAllowed).filter(Boolean);
    if (filtered.length === 0) return;

    setCells((prev) => {
      const next = [...prev];
      let cursor = index;
      for (const ch of filtered) {
        if (cursor >= CODE_LENGTH) break;
        next[cursor] = ch;
        cursor++;
      }
      // Focus the next empty or end
      const focusAt = Math.min(cursor, CODE_LENGTH - 1);
      setTimeout(() => inputRefs.current[focusAt]?.focus(), 0);
      return next;
    });
  };

  const handleJoin = async () => {
    if (!canJoin) return;
    setLoading(true);
    setError(null);
    try {
      const room = await joinByCode(code, playerName);
      onJoined(room);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Room not found or connection failed. Check the code and try again.');
      setLoading(false);
    }
  };

  return (
    <ModalShell
      kicker="MULTIPLAYER"
      title="Join by Code"
      onCancel={onCancel}
      primary={{ label: loading ? 'JOINING…' : 'JOIN', onClick: handleJoin, disabled: !canJoin }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        <div>
          <div
            style={{
              fontFamily: theme.fontMono,
              fontSize: 10,
              color: theme.inkMuted,
              letterSpacing: 3,
              marginBottom: 12,
            }}
          >
            ENTER 6-CHARACTER ROOM CODE
          </div>

          {/* Six-cell code input */}
          <div style={{ display: 'flex', gap: 10 }}>
            {cells.map((ch, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                value={ch}
                onChange={(e) => handleInput(i, e)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                maxLength={CODE_LENGTH} // Allow paste
                disabled={loading}
                autoComplete="off"
                style={{
                  width: 56,
                  height: 64,
                  textAlign: 'center',
                  background: theme.panel,
                  border: `1px solid ${ch ? theme.accent : theme.line}`,
                  color: theme.ink,
                  fontFamily: theme.fontMono,
                  fontSize: 24,
                  letterSpacing: 2,
                  outline: 'none',
                  cursor: loading ? 'not-allowed' : 'text',
                  opacity: loading ? 0.5 : 1,
                  boxShadow: ch ? `0 0 0 1px ${theme.accent}22` : 'none',
                  transition: 'border-color 100ms ease, box-shadow 100ms ease',
                }}
              />
            ))}
          </div>

          <div
            style={{
              marginTop: 10,
              fontFamily: theme.fontMono,
              fontSize: 10,
              color: theme.inkMuted,
              letterSpacing: 1,
            }}
          >
            Letters and digits only · auto-advances on input · paste supported
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
