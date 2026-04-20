import { useState } from 'react';
import { GUILDS } from '../simulation/guildData';
import type { GuildId } from '../simulation/types';

interface Props {
  onSelect: (guildId: GuildId) => void;
}

const COMBO_LABELS: Record<string, string> = {
  'down,down,attack': '↓↓J',
  'right,right,attack': '→→J',
  'down,up,attack': '↓↑J',
  'left,right,attack': '←→J',
  'down,up,down,up,attack': '↓↑↓↑J (Ultimate)',
  'block+attack': 'K+J',
};

function StatBar({ label, value, max = 20, color }: { label: string; value: number; max?: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
      <span style={{ color: '#9ca3af', fontSize: 10, width: 28 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: '#1f2937', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ color: '#e5e7eb', fontSize: 10, width: 18, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export function GuildSelect({ onSelect }: Props) {
  const [hovered, setHovered] = useState<GuildId | null>(null);
  const [selected, setSelected] = useState<GuildId | null>(null);

  const focused = selected || hovered;
  const focusedGuild = focused ? GUILDS.find(g => g.id === focused) : null;

  return (
    <div style={{
      width: '100%',
      maxWidth: 900,
      margin: '0 auto',
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'sans-serif',
      color: '#f9fafb',
    }}>
      <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
        <h1 style={{
          margin: 0,
          fontSize: 28,
          fontFamily: 'Georgia, serif',
          background: 'linear-gradient(135deg, #fbbf24, #f97316)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: 2,
        }}>
          SELECT YOUR GUILD
        </h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 12 }}>
          Choose your fighter — 15 guilds, each with unique abilities
        </p>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 0 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          padding: 16,
          flex: 1,
          alignContent: 'start',
        }}>
          {GUILDS.map(guild => {
            const isSelected = selected === guild.id;
            const isHovered = hovered === guild.id;
            const active = isSelected || isHovered;
            return (
              <button
                key={guild.id}
                onClick={() => setSelected(guild.id)}
                onMouseEnter={() => setHovered(guild.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: active
                    ? `linear-gradient(135deg, ${guild.color}33, ${guild.color}22)`
                    : 'rgba(30,41,59,0.8)',
                  border: `2px solid ${active ? guild.color : '#374151'}`,
                  borderRadius: 8,
                  padding: '10px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s ease',
                  transform: active ? 'scale(1.03)' : 'scale(1)',
                }}
              >
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: guild.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  color: '#ffffff',
                  border: `2px solid ${active ? '#ffffff' : 'transparent'}`,
                }}>
                  {guild.initial}
                </div>
                <span style={{ color: '#f9fafb', fontWeight: 600, fontSize: 11 }}>{guild.name}</span>
                <span style={{ color: '#9ca3af', fontSize: 9, textAlign: 'center' }}>
                  HP {guild.hpMax}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{
          width: 280,
          padding: 16,
          borderLeft: '1px solid #1f2937',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          overflowY: 'auto',
        }}>
          {focusedGuild ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  background: focusedGuild.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  color: '#fff',
                  flexShrink: 0,
                }}>
                  {focusedGuild.initial}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: focusedGuild.color }}>
                    {focusedGuild.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>{focusedGuild.description}</div>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 10 }}>
                <div style={{ color: '#9ca3af', fontSize: 10, marginBottom: 6, fontWeight: 600 }}>STATS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                  <StatBar label="STR" value={focusedGuild.stats.STR} color="#ef4444" />
                  <StatBar label="DEX" value={focusedGuild.stats.DEX} color="#f59e0b" />
                  <StatBar label="CON" value={focusedGuild.stats.CON} color="#84cc16" />
                  <StatBar label="INT" value={focusedGuild.stats.INT} color="#818cf8" />
                  <StatBar label="WIS" value={focusedGuild.stats.WIS} color="#67e8f9" />
                  <StatBar label="CHA" value={focusedGuild.stats.CHA} color="#f0abfc" />
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  <span style={{ color: '#9ca3af', fontSize: 10 }}>HP: <b style={{ color: '#f9fafb' }}>{focusedGuild.hpMax}</b></span>
                  <span style={{ color: '#9ca3af', fontSize: 10 }}>Armor: <b style={{ color: '#f9fafb' }}>{focusedGuild.armor}</b></span>
                  <span style={{ color: '#9ca3af', fontSize: 10 }}>MR: <b style={{ color: '#f9fafb' }}>{focusedGuild.magicResist}</b></span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ color: '#9ca3af', fontSize: 10 }}>
                    Resource: <b style={{ color: focusedGuild.resource.color }}>{focusedGuild.resource.name}</b>
                    {' '}({focusedGuild.resource.max})
                  </span>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 10 }}>
                <div style={{ color: '#9ca3af', fontSize: 10, marginBottom: 6, fontWeight: 600 }}>ABILITIES</div>
                {focusedGuild.abilities.map(ab => (
                  <div key={ab.id} style={{ marginBottom: 6, borderBottom: '1px solid #1f2937', paddingBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        background: '#1e40af',
                        color: '#93c5fd',
                        fontSize: 9,
                        fontFamily: 'monospace',
                        padding: '1px 4px',
                        borderRadius: 3,
                        flexShrink: 0,
                      }}>
                        {COMBO_LABELS[ab.combo] || ab.combo}
                      </span>
                      <span style={{ color: '#f9fafb', fontSize: 11, fontWeight: 600 }}>{ab.name}</span>
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: 9, marginTop: 2 }}>
                      {ab.description}
                      {ab.cost > 0 && <span style={{ color: focusedGuild.resource.color }}> • Cost: {ab.cost}</span>}
                      {ab.cooldownMs > 0 && <span style={{ color: '#6b7280' }}> • CD: {ab.cooldownMs / 1000}s</span>}
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 4, paddingTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      background: '#065f46',
                      color: '#6ee7b7',
                      fontSize: 9,
                      fontFamily: 'monospace',
                      padding: '1px 4px',
                      borderRadius: 3,
                    }}>K+J</span>
                    <span style={{ color: '#f9fafb', fontSize: 11, fontWeight: 600 }}>{focusedGuild.rmb.name}</span>
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: 9, marginTop: 2 }}>{focusedGuild.rmb.description}</div>
                </div>
              </div>

              {selected === focusedGuild.id && (
                <button
                  onClick={() => onSelect(selected)}
                  style={{
                    background: `linear-gradient(135deg, ${focusedGuild.color}, ${focusedGuild.color}cc)`,
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 0',
                    color: '#ffffff',
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: 'pointer',
                    letterSpacing: 1,
                    transition: 'all 0.15s',
                  }}
                >
                  ▶  FIGHT AS {focusedGuild.name.toUpperCase()}
                </button>
              )}
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4b5563',
              fontSize: 13,
              textAlign: 'center',
            }}>
              Hover over a guild<br />to see details
            </div>
          )}
        </div>
      </div>

      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid #1f2937',
        display: 'flex',
        justifyContent: 'center',
        gap: 24,
        fontSize: 10,
        color: '#4b5563',
      }}>
        <span>← → ↑ ↓ Move</span>
        <span>Space Jump</span>
        <span>J Attack</span>
        <span>K Block</span>
        <span>L Grab/Throw</span>
        <span>Esc Pause</span>
      </div>
    </div>
  );
}
