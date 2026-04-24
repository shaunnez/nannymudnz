import { useEffect, useMemo, useState } from 'react';
import { GUILDS, DRUID_WOLF_ABILITIES, DRUID_WOLF_RMB } from '@nannymud/shared/simulation/guildData';
import { GUILD_META } from '../data/guildMeta';
import type { GuildId, AbilityDef } from '@nannymud/shared/simulation/types';
import { theme, guildAccent, Btn, Chip, SectionLabel, GuildMonogram, ComboDisplay } from '../ui';
import { AbilityPreview } from '../ui/AbilityPreview';

interface Props {
  initialGuild?: GuildId;
  onBack: () => void;
  onDossier: (guildId: GuildId) => void;
}

const SLOT_LABELS = ['01', '02', '03', '04', '05'];

export function MoveList({ initialGuild, onBack, onDossier }: Props) {
  const [sel, setSel] = useState<GuildId>(initialGuild ?? GUILDS[0].id);
  const [druidForm, setDruidForm] = useState<'druid' | 'wolf'>('druid');
  useEffect(() => { setDruidForm('druid'); }, [sel]);

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

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr', overflow: 'hidden' }}>
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
                  gridTemplateColumns: '44px 1fr auto',
                  gap: 14,
                  alignItems: 'center',
                  padding: '8px 22px',
                  borderBottom: `1px solid ${theme.lineSoft}`,
                  cursor: 'pointer',
                  background: isActive ? `${acc}12` : 'transparent',
                  borderLeft: `3px solid ${isActive ? acc : 'transparent'}`,
                }}
              >
                <GuildMonogram guildId={g.id} size={36} />
                <div>
                  <div
                    style={{
                      fontFamily: theme.fontDisplay,
                      fontSize: 16,
                      color: isActive ? acc : theme.ink,
                      letterSpacing: '-0.01em',
                      lineHeight: 1.2,
                    }}
                  >
                    {g.name}
                  </div>
                  <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 2, marginTop: 2 }}>
                    {m.tag.toUpperCase()}
                  </div>
                </div>
                <span style={{ fontFamily: theme.fontMono, fontSize: 13, color: isActive ? acc : theme.inkMuted }}>
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
              <div style={{ fontFamily: theme.fontMono, fontSize: 14, color: accent, letterSpacing: 4 }}>
                {meta.tag.toUpperCase()}
              </div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: 30, color: theme.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {guild.name}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip mono tone="accent">{guild.resource.name.toUpperCase()} · {guild.resource.max}</Chip>
                <Chip mono>HP · {guild.hpMax}</Chip>
                <Chip mono>ARM · {meta.uiVitals.Armor}</Chip>
                <Chip mono>MR · {meta.uiVitals.MR}</Chip>
                <Chip mono>MV · {meta.uiVitals.Move}</Chip>
                {sel === 'druid' && (['druid', 'wolf'] as const).map((form) => (
                  <button
                    key={form}
                    type="button"
                    onClick={() => setDruidForm(form)}
                    style={{
                      appearance: 'none',
                      border: `1px solid ${druidForm === form ? accent : theme.lineSoft}`,
                      background: druidForm === form ? `${accent}18` : theme.panel,
                      color: druidForm === form ? accent : theme.inkDim,
                      fontFamily: theme.fontMono,
                      fontSize: 11,
                      letterSpacing: 3,
                      padding: '4px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    {form === 'druid' ? 'DRUID' : 'WOLF'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <SectionLabel
            kicker={sel === 'druid' && druidForm === 'wolf' ? 'WOLF FORM' : 'ABILITIES'}
            right={`${sel === 'druid' && druidForm === 'wolf' ? DRUID_WOLF_ABILITIES.length : guild.abilities.length} + 6`}
          >
            {sel === 'druid' && druidForm === 'wolf' ? 'Abilities while shapeshifted' : 'Combat moves'}
          </SectionLabel>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <MoveHeader />
            {(sel === 'druid' && druidForm === 'wolf' ? DRUID_WOLF_ABILITIES : guild.abilities).map((a, i) => (
              <MoveRow
                key={a.id}
                slot={SLOT_LABELS[i]}
                ability={a}
                accent={accent}
                guildId={sel}
                abilityIndex={i}
                spriteGuildId={sel === 'druid' && druidForm === 'wolf' ? 'wolf' : undefined}
              />
            ))}
            <MoveRow
              slot="6"
              ability={sel === 'druid' && druidForm === 'wolf' ? DRUID_WOLF_RMB : guild.rmb}
              accent={accent}
              guildId={sel}
              abilityIndex={-1}
              spriteGuildId={sel === 'druid' && druidForm === 'wolf' ? 'wolf' : undefined}
            />
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

const TABLE_COLS = '100px 72px 180px 1fr 240px 110px 110px';

function MoveHeader() {
  const cell: React.CSSProperties = {
    fontFamily: theme.fontMono,
    fontSize: 12,
    color: theme.inkMuted,
    letterSpacing: 3,
  };
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_COLS,
        gap: 14,
        padding: '14px 6px',
        borderBottom: `1px solid ${theme.lineSoft}`,
      }}
    >
      <span style={cell} />
      <span style={cell}>SLOT</span>
      <span style={cell}>COMBO</span>
      <span style={cell}>NAME / EFFECT</span>
      <span style={cell}>TAGS</span>
      <span style={cell}>CD</span>
      <span style={cell}>COST</span>
    </div>
  );
}

const WOLF_ANIM: Record<number, string> = { 0: 'attack_1', 1: 'run', 2: 'idle', 3: 'attack_1', 4: 'idle' };

function MoveRow({
  slot,
  ability,
  accent,
  guildId,
  abilityIndex,
  spriteGuildId,
}: {
  slot: string;
  ability: AbilityDef;
  accent: string;
  guildId: GuildId;
  abilityIndex: number;
  spriteGuildId?: string;
}) {
  const animationId = spriteGuildId
    ? (abilityIndex >= 0 ? (WOLF_ANIM[abilityIndex] ?? 'idle') : 'idle')
    : abilityIndex >= 0 ? `ability_${abilityIndex + 1}` : 'basic_attack';
  const cdLabel = ability.cooldownMs > 0
    ? `${(ability.cooldownMs / 1000).toFixed(ability.cooldownMs < 10000 ? 1 : 0)}s`
    : '—';
  const costLabel = ability.cost > 0 ? String(ability.cost) : '—';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_COLS,
        gap: 14,
        padding: '10px 6px',
        borderBottom: `1px solid ${theme.lineSoft}`,
        alignItems: 'start',
      }}
    >
      <div style={{ width: 64, height: 64, flexShrink: 0 }}>
        <AbilityPreview
          guildId={guildId}
          abilityId={ability.id}
          animationId={animationId}
          spriteScale={0.9}
          vfxScale={1.1}
          spriteGuildId={spriteGuildId}
        />
      </div>
      <span style={{ fontFamily: theme.fontMono, fontSize: 22, color: accent, letterSpacing: 2, lineHeight: 1 }}>
        {slot}
      </span>
      <span style={{ display: 'flex', alignItems: 'center' }}>
        <ComboDisplay combo={ability.combo} size={24} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 22, color: theme.ink, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
          {ability.name}
        </div>
        <div style={{ fontFamily: theme.fontBody, fontSize: 16, color: theme.inkDim, lineHeight: 1.5, marginTop: 4 }}>
          {ability.description || '—'}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {ability.baseDamage > 0 && <TagPill tone="warn">DMG · {ability.baseDamage}</TagPill>}
        {ability.isHeal && <TagPill tone="good">HEAL</TagPill>}
        {ability.isProjectile && <TagPill>PROJECTILE</TagPill>}
        {ability.isTeleport && <TagPill>BLINK</TagPill>}
        {ability.isChannel && <TagPill>CHANNEL</TagPill>}
        {ability.aoeRadius > 0 && <TagPill>AOE</TagPill>}
      </div>
      <span style={{ fontFamily: theme.fontMono, fontSize: 20, color: ability.cooldownMs > 0 ? theme.ink : theme.inkMuted, letterSpacing: 1 }}>
        {cdLabel}
      </span>
      <span style={{ fontFamily: theme.fontMono, fontSize: 20, color: ability.cost > 0 ? accent : theme.inkMuted, letterSpacing: 1 }}>
        {costLabel}
      </span>
    </div>
  );
}

type TagTone = 'default' | 'warn' | 'good';

const TAG_TONES: Record<TagTone, { fg: string; bd: string }> = {
  default: { fg: theme.inkDim, bd: theme.line },
  warn:    { fg: theme.warn,   bd: theme.warn },
  good:    { fg: theme.good,   bd: theme.good },
};

function TagPill({ children, tone = 'default' }: { children: React.ReactNode; tone?: TagTone }) {
  const t = TAG_TONES[tone];
  return (
    <span
      style={{
        display: 'block',
        textAlign: 'center',
        padding: '6px 10px',
        border: `1px solid ${t.bd}`,
        color: t.fg,
        fontFamily: theme.fontMono,
        fontSize: 13,
        letterSpacing: 2,
        textTransform: 'uppercase',
        borderRadius: 2,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </span>
  );
}
