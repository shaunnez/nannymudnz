import { useEffect, useState } from 'react';
import { theme, Btn, Chip, SectionLabel } from '../ui';
import { loadKeyBindings, saveKeyBindings, DEFAULT_BINDINGS, type KeyBindings } from '../input/keyBindings';

const VOL_KEY = 'nannymud_volume';

function loadVolume(): number {
  try {
    const v = localStorage.getItem(VOL_KEY);
    return v !== null ? parseFloat(v) : 0.5;
  } catch { return 0.5; }
}

function saveVolume(v: number): void {
  try { localStorage.setItem(VOL_KEY, String(v)); } catch { /* noop */ }
}

const BIND_ORDER: (keyof KeyBindings)[] = [
  'left', 'right', 'up', 'down', 'jump', 'attack', 'block', 'grab', 'pause', 'fullscreen',
];

const BIND_LABELS: Record<keyof KeyBindings, string> = {
  left: 'Move left',
  right: 'Move right',
  up: 'Dodge back',
  down: 'Dodge forward',
  jump: 'Jump',
  attack: 'Attack',
  block: 'Block',
  grab: 'Grab',
  pause: 'Pause',
  fullscreen: 'Fullscreen',
};

function formatKey(k: string): string {
  if (k === ' ') return 'SPACE';
  if (k.startsWith('Arrow')) return k.replace('Arrow', '').toUpperCase();
  return k.toUpperCase();
}

interface Props {
  animateHud: boolean;
  showLog: boolean;
  onToggleAnimateHud: () => void;
  onToggleShowLog: () => void;
  onBack: () => void;
}

export function SettingsScreen({ animateHud, showLog, onToggleAnimateHud, onToggleShowLog, onBack }: Props) {
  const [volume, setVolume] = useState(loadVolume);
  const [bindings, setBindings] = useState<KeyBindings>(loadKeyBindings);
  const [rebinding, setRebinding] = useState<keyof KeyBindings | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (rebinding) {
        e.preventDefault();
        if (e.key === 'Escape') { setRebinding(null); return; }
        const next = { ...bindings, [rebinding]: e.key };
        setBindings(next);
        saveKeyBindings(next);
        setRebinding(null);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); onBack(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rebinding, bindings, onBack]);

  const onVolume = (v: number) => { setVolume(v); saveVolume(v); };

  const resetBindings = () => {
    setBindings({ ...DEFAULT_BINDINGS });
    saveKeyBindings({ ...DEFAULT_BINDINGS });
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '18px 36px',
          borderBottom: `1px solid ${theme.lineSoft}`,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
        }}
      >
        <div style={{ justifySelf: 'start' }}><Btn size="md" onClick={onBack}>← MENU</Btn></div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
            CONFIG · 12
          </span>
          <span style={{ fontFamily: theme.fontDisplay, fontSize: 24, color: theme.ink }}>
            Settings
          </span>
        </div>
        <div style={{ justifySelf: 'end' }}>
          <Btn size="md" onClick={resetBindings}>RESET KEYS</Btn>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
        <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22, overflow: 'auto' }}>
          <SectionLabel kicker="AUDIO" right={`${Math.round(volume * 100)}%`}>
            Master volume
          </SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => onVolume(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: theme.accent }}
            />
            <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.accent, minWidth: 44, textAlign: 'right' }}>
              {Math.round(volume * 100)}%
            </span>
          </div>
          <div style={{ fontFamily: theme.fontBody, fontSize: 11, color: theme.inkMuted, lineHeight: 1.5 }}>
            Music and combat SFX share this slider. Applies to the next match.
          </div>

          <SectionLabel kicker="VIDEO">Terminal chrome</SectionLabel>
          <Toggle
            label="Animate HUD"
            sub="Pulse meters, glow combo text, flicker scanlines on hit"
            on={animateHud}
            onClick={onToggleAnimateHud}
          />
          <Toggle
            label="Show scroll log"
            sub="Display the rolling combat log during battle (when implemented)"
            on={showLog}
            onClick={onToggleShowLog}
          />
        </div>

        <div
          style={{
            padding: 32,
            borderLeft: `1px solid ${theme.lineSoft}`,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <SectionLabel kicker="CONTROLS" right={rebinding ? 'PRESS A KEY · ESC CANCELS' : 'CLICK TO REBIND'}>
            Keyboard
          </SectionLabel>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {BIND_ORDER.map((k) => {
              const isRebinding = rebinding === k;
              return (
                <div
                  key={k}
                  onClick={() => setRebinding(k)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 130px',
                    gap: 12,
                    alignItems: 'center',
                    padding: '10px 14px',
                    background: isRebinding ? `${theme.accent}16` : theme.panel,
                    border: `1px solid ${isRebinding ? theme.accent : theme.lineSoft}`,
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ fontFamily: theme.fontDisplay, fontSize: 15, color: theme.ink }}>
                      {BIND_LABELS[k]}
                    </div>
                    <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>
                      {k.toUpperCase()}
                    </div>
                  </div>
                  {bindings[k] !== DEFAULT_BINDINGS[k] && (
                    <Chip mono tone="warn">CUSTOM</Chip>
                  )}
                  <div
                    style={{
                      justifySelf: 'end',
                      padding: '6px 12px',
                      minWidth: 88,
                      textAlign: 'center',
                      background: theme.bgDeep,
                      border: `1px solid ${isRebinding ? theme.accent : theme.line}`,
                      fontFamily: theme.fontMono,
                      fontSize: 12,
                      color: isRebinding ? theme.accent : theme.ink,
                      letterSpacing: 2,
                    }}
                  >
                    {isRebinding ? '···' : formatKey(bindings[k])}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

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
        <span>CLICK A KEY TO REBIND</span>
        <span>ESC MENU</span>
      </div>
    </div>
  );
}

function Toggle({ label, sub, on, onClick }: { label: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 12,
        alignItems: 'center',
        padding: '12px 14px',
        background: theme.panel,
        border: `1px solid ${on ? theme.accent : theme.lineSoft}`,
        cursor: 'pointer',
      }}
    >
      <div>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 15, color: theme.ink }}>{label}</div>
        <div style={{ fontFamily: theme.fontBody, fontSize: 11, color: theme.inkMuted, lineHeight: 1.5, marginTop: 2 }}>
          {sub}
        </div>
      </div>
      <div
        style={{
          width: 52,
          height: 26,
          borderRadius: 13,
          background: on ? theme.accent : theme.bgDeep,
          border: `1px solid ${on ? theme.accent : theme.line}`,
          position: 'relative',
          transition: 'background 150ms',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 28 : 2,
            width: 20,
            height: 20,
            borderRadius: 10,
            background: on ? theme.bgDeep : theme.inkDim,
            transition: 'left 150ms',
          }}
        />
      </div>
    </div>
  );
}
