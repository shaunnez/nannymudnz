import { useEffect, useMemo, useState } from 'react';
import { GUILDS } from '../simulation/guildData';
import { GUILD_META } from '../data/guildMeta';
import type { GuildId, AbilityDef } from '../simulation/types';
import { theme, guildAccent, Btn, Chip, SectionLabel, GuildMonogram, ComboDisplay } from '../ui';

interface Props {
  initialGuild?: GuildId;
  onBack: () => void;
  onDossier: (guildId: GuildId) => void;
}

const SLOT_LABELS = ['01', '02', '03', '04', '05'];

export function MoveList({ initialGuild, onBack, onDossier }: Props) {
  const [sel, setSel] = useState<GuildId>(initialGuild ?? GUILDS[0].id);

  const guild = useMemo(() => GUILDS.find((g) => g.id === sel)!, [sel]);
  const meta = GUILD_META[sel];
  const accent = guildAccent(meta.hue);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onBack(); return; }
      if (e.key === 'Enter') { e.preventDefault(); onDossier(sel); return; }
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'j' && e.key !== 'k') return;
      e.preventDefault();
      const idx = GUILDS.findIndex((g) => g.id === sel);
      const next = e.key === 'ArrowUp' || e.key === 'k'
        ? (idx - 1 + GUILDS.length) % GUILDS.length
        : (idx + 1) % GUILDS.length;
      setSel(GUILDS[next].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, onBack, onDossier]);

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
        <div style={{ justifySelf: 'start' }}>
          <Btn size="md" onClick={onBack}>← MENU</Btn>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
            REFERENCE · 10
          </span>
          <span style={{ fontFamily: theme.fontDisplay, fontSize: 24, color: theme.ink }}>
            Move list
          </span>
        </div>
        <div style={{ justifySelf: 'end' }}>
          <Btn size="md" primary onClick={() => onDossier(sel)}>DOSSIER ↵</Btn>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr', overflow: 'hidden' }}>
        <div style={{ borderRight: `1px solid ${theme.lineSoft}`, overflow: 'auto' }}>
          {GUILDS.map((g) => {
            const m = GUILD_META[g.id];
            const isActive = g.id === sel;
            const acc = guildAccent(m.hue);
            return (
              <div
                key={g.id}
                onMouseEnter={() => setSel(g.id)}
                onClick={() => setSel(g.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: '10px 18px',
                  borderBottom: `1px solid ${theme.lineSoft}`,
                  cursor: 'pointer',
                  background: isActive ? `${acc}12` : 'transparent',
                  borderLeft: `3px solid ${isActive ? acc : 'transparent'}`,
                }}
              >
                <GuildMonogram guildId={g.id} size={28} />
                <div>
                  <div
                    style={{
                      fontFamily: theme.fontDisplay,
                      fontSize: 15,
                      color: isActive ? acc : theme.ink,
                      lineHeight: 1.2,
                    }}
                  >
                    {g.name}
                  </div>
                  <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>
                    {m.tag.toUpperCase()}
                  </div>
                </div>
                <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: isActive ? acc : theme.inkMuted }}>
                  {isActive ? '▸' : ''}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ padding: 32, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 18, alignItems: 'center' }}>
            <GuildMonogram guildId={sel} size={88} selected />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 4 }}>
                {meta.tag.toUpperCase()}
              </div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: 44, color: theme.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {guild.name}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Chip mono tone="accent">{guild.resource.name.toUpperCase()} · {guild.resource.max}</Chip>
                <Chip mono>HP · {guild.hpMax}</Chip>
                <Chip mono>ARM · {meta.uiVitals.Armor}</Chip>
                <Chip mono>MR · {meta.uiVitals.MR}</Chip>
                <Chip mono>MV · {meta.uiVitals.Move}</Chip>
              </div>
            </div>
          </div>

          <SectionLabel kicker="ABILITIES" right={`5 COMBOS + 1 RMB`}>
            Inputs route via the combo buffer
          </SectionLabel>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {guild.abilities.map((a, i) => (
              <MoveRow key={a.id} slot={SLOT_LABELS[i]} ability={a} accent={accent} />
            ))}
            <MoveRow slot="RMB" ability={guild.rmb} accent={accent} />
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
        <span>↑↓ SELECT</span>
        <span>↵ DOSSIER</span>
        <span>ESC MENU</span>
      </div>
    </div>
  );
}

function MoveRow({ slot, ability, accent }: { slot: string; ability: AbilityDef; accent: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '52px 1fr',
        gap: 12,
        padding: 12,
        background: theme.panel,
        border: `1px solid ${theme.lineSoft}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.fontMono,
          fontSize: 11,
          color: accent,
          letterSpacing: 2,
          borderRight: `1px solid ${theme.lineSoft}`,
        }}
      >
        {slot}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: theme.fontDisplay, fontSize: 17, color: accent, lineHeight: 1.15 }}>
            {ability.name}
          </span>
          <ComboDisplay combo={ability.combo} size={13} />
        </div>
        <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkDim, lineHeight: 1.45 }}>
          {ability.description || '—'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
          {ability.cost > 0 && <Chip mono>COST · {ability.cost}</Chip>}
          {ability.cooldownMs > 0 && <Chip mono>CD · {(ability.cooldownMs / 1000).toFixed(ability.cooldownMs < 10000 ? 1 : 0)}s</Chip>}
          {ability.range > 0 && <Chip mono>RNG · {ability.range}</Chip>}
          {ability.aoeRadius > 0 && <Chip mono>AOE · {ability.aoeRadius}</Chip>}
          {ability.baseDamage > 0 && <Chip mono tone="warn">DMG · {ability.baseDamage}</Chip>}
          {ability.isHeal && <Chip mono tone="good">HEAL</Chip>}
          {ability.isProjectile && <Chip mono>PROJECTILE</Chip>}
          {ability.isTeleport && <Chip mono>BLINK</Chip>}
          {ability.isChannel && <Chip mono>CHANNEL · {(ability.channelDurationMs / 1000).toFixed(1)}s</Chip>}
        </div>
      </div>
    </div>
  );
}
