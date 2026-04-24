import { useState } from 'react';
import type { GuildId, BattleSlot, BattleTeam } from '@nannymud/shared/simulation/types';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { theme, Btn, GuildMonogram, SCANLINE_BG } from '../ui';

const TEAM_COLORS: Record<NonNullable<BattleTeam>, string> = {
  A: '#5cf2c2',
  B: '#ff5d73',
  C: '#ffb347',
  D: '#928bff',
};

type SlotType = 'human' | 'cpu' | 'off';

interface SlotConfig {
  type: SlotType;
  guildId: GuildId;
  team: BattleTeam;
}

interface Props {
  humanGuildId: GuildId;
  onBack: () => void;
  onReady: (slots: BattleSlot[]) => void;
}

function buildDefaultSlots(humanGuildId: GuildId): SlotConfig[] {
  const ids = GUILDS.map((g) => g.id).filter((id) => id !== humanGuildId);
  return [
    { type: 'human', guildId: humanGuildId,        team: 'A' },
    { type: 'cpu',   guildId: ids[0] ?? 'knight',  team: 'A' },
    { type: 'cpu',   guildId: ids[1] ?? 'mage',    team: 'A' },
    { type: 'cpu',   guildId: ids[2] ?? 'druid',   team: 'A' },
    { type: 'cpu',   guildId: ids[3] ?? 'hunter',  team: 'B' },
    { type: 'cpu',   guildId: ids[4] ?? 'monk',    team: 'B' },
    { type: 'cpu',   guildId: ids[5] ?? 'viking',  team: 'B' },
    { type: 'cpu',   guildId: ids[6] ?? 'prophet', team: 'B' },
  ];
}

export function BattleConfigScreen({ humanGuildId, onBack, onReady }: Props) {
  const [slots, setSlots] = useState<SlotConfig[]>(() => buildDefaultSlots(humanGuildId));

  const updateSlot = (i: number, patch: Partial<SlotConfig>) =>
    setSlots((ss) => ss.map((s, j) => (j !== i ? s : { ...s, ...patch })));

  const cycleType = (i: number) => {
    if (slots[i].type === 'human') return;
    const next: SlotType = slots[i].type === 'cpu' ? 'off' : 'cpu';
    updateSlot(i, { type: next });
  };

  const cycleGuild = (i: number) => {
    if (slots[i].type !== 'cpu') return;
    const ids = GUILDS.map((g) => g.id);
    const cur = ids.indexOf(slots[i].guildId);
    updateSlot(i, { guildId: ids[(cur + 1) % ids.length] });
  };

  const activeCount = slots.filter((s) => s.type !== 'off').length;
  const canStart = activeCount >= 2;

  const handleReady = () => {
    const out: BattleSlot[] = slots
      .filter((s) => s.type !== 'off')
      .map((s) => ({ guildId: s.guildId, type: s.type, team: s.team }));
    onReady(out);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: SCANLINE_BG, pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ padding: '20px 36px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>SLOTS · CONFIG</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink }}>Set the field</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={onBack}>← BACK</Btn>
          <Btn primary disabled={!canStart} onClick={handleReady}>STAGE →</Btn>
        </div>
      </div>

      {/* 4-column grid */}
      <div style={{ flex: 1, padding: '24px 32px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, overflow: 'auto' }}>
        {slots.map((s, i) => {
          const isOff = s.type === 'off';
          const isHuman = s.type === 'human';
          const teamColor = s.team ? TEAM_COLORS[s.team] : theme.lineSoft;
          const borderColor = isHuman ? theme.accent : isOff ? theme.lineSoft : teamColor;

          return (
            <div key={i} style={{
              border: `1px solid ${borderColor}`,
              background: isOff ? 'transparent' : theme.panel,
              padding: 14,
              display: 'flex', flexDirection: 'column', gap: 10,
              opacity: isOff ? 0.45 : 1,
            }}>
              {/* Slot header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>
                  SLOT {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  onClick={() => cycleType(i)}
                  style={{
                    cursor: isHuman ? 'default' : 'pointer',
                    fontFamily: theme.fontMono, fontSize: 9, letterSpacing: 2,
                    color: isOff ? theme.inkMuted : isHuman ? theme.accent : theme.good,
                    border: `1px solid ${isOff ? theme.lineSoft : isHuman ? theme.accent : theme.good}`,
                    padding: '2px 5px',
                  }}
                >
                  {s.type.toUpperCase()}
                </span>
              </div>

              {/* Guild */}
              <div
                onClick={() => cycleGuild(i)}
                style={{ display: 'flex', justifyContent: 'center', cursor: s.type === 'cpu' ? 'pointer' : 'default' }}
              >
                {isOff ? (
                  <div style={{ width: 80, height: 80, border: `1px dashed ${theme.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>
                    EMPTY
                  </div>
                ) : (
                  <GuildMonogram guildId={s.guildId} size={80} selected={isHuman} />
                )}
              </div>

              {!isOff && (
                <>
                  <div style={{ fontFamily: theme.fontDisplay, fontSize: 14, color: isHuman ? theme.accent : theme.ink, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {GUILDS.find((g) => g.id === s.guildId)?.name ?? s.guildId}
                  </div>

                  {/* Team selector */}
                  <div>
                    <div style={{ fontFamily: theme.fontMono, fontSize: 8, color: theme.inkMuted, letterSpacing: 2, marginBottom: 4 }}>TEAM</div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {([null, 'A', 'B', 'C', 'D'] as BattleTeam[]).map((t) => {
                        const active = s.team === t;
                        const c = t ? TEAM_COLORS[t] : theme.inkMuted;
                        return (
                          <span
                            key={String(t)}
                            onClick={() => updateSlot(i, { team: t })}
                            style={{
                              flex: 1, textAlign: 'center', padding: '3px 0',
                              fontFamily: theme.fontMono, fontSize: 9, cursor: 'pointer',
                              border: `1px solid ${active ? c : theme.lineSoft}`,
                              color: active ? c : theme.inkDim,
                              background: active ? `${c}18` : 'transparent',
                            }}
                          >
                            {t ?? '—'}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div style={{ padding: '10px 36px', borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', gap: 24, fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>
        <span>CLICK TYPE TO CYCLE · CPU / OFF</span>
        <span>CLICK GUILD TO CYCLE</span>
        <span>{activeCount} ACTIVE SLOTS</span>
      </div>
    </div>
  );
}

// Re-export for convenience
export type { SlotConfig };
