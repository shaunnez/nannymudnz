import { useEffect, useMemo } from 'react';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { GUILD_META } from '../data/guildMeta';
import type { GuildId, Stats } from '@nannymud/shared/simulation/types';
import { theme, guildAccent, Btn, Chip, SectionLabel, GuildMonogram, SpriteStrip, ComboDisplay, MeterBar } from '../ui';

interface Props {
  guildId: GuildId;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
}

const STAT_KEYS: (keyof Stats)[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const STAT_MAX = 20;

export function GuildDossier({ guildId, onBack, onPrev, onNext }: Props) {
  const guild = useMemo(() => GUILDS.find((g) => g.id === guildId)!, [guildId]);
  const meta = GUILD_META[guildId];
  const accent = guildAccent(meta.hue);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onBack(); return; }
      if (e.key === 'ArrowLeft' || e.key === 'h') { e.preventDefault(); onPrev(); return; }
      if (e.key === 'ArrowRight' || e.key === 'l') { e.preventDefault(); onNext(); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, onPrev, onNext]);

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
        <div style={{ justifySelf: 'start' }}><Btn size="md" onClick={onBack}>← BACK</Btn></div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
            REFERENCE · 11
          </span>
          <span style={{ fontFamily: theme.fontDisplay, fontSize: 24, color: theme.ink }}>
            Guild dossier
          </span>
        </div>
        <div style={{ justifySelf: 'end', display: 'flex', gap: 8 }}>
          <Btn size="md" onClick={onPrev}>← PREV</Btn>
          <Btn size="md" onClick={onNext}>NEXT →</Btn>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
        <div
          style={{
            padding: 40,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: `linear-gradient(180deg, ${accent}16, transparent 70%)`,
            overflow: 'auto',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 18, alignItems: 'center' }}>
            <GuildMonogram guildId={guildId} size={120} selected />
            <div>
              <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 5 }}>
                {meta.tag.toUpperCase()}
              </div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: 54, color: theme.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {guild.name}
              </div>
              <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkDim, marginTop: 4 }}>
                {meta.sub}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: 14,
              border: `1px solid ${theme.lineSoft}`,
              background: theme.panel,
              fontFamily: theme.fontBody,
              fontSize: 13,
              color: theme.inkDim,
              lineHeight: 1.6,
              fontStyle: 'italic',
            }}
          >
            {meta.bio}
          </div>

          <SectionLabel kicker="SPRITES" right="IDLE · WALK · ATTACK">
            Presence in the ring
          </SectionLabel>
          <div style={{ display: 'flex', gap: 10 }}>
            {['idle', 'walk', 'attack_1'].map((anim) => (
              <div
                key={anim}
                style={{
                  flex: 1,
                  background: theme.bgDeep,
                  border: `1px solid ${theme.lineSoft}`,
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <SpriteStrip guildId={guildId} animationId={anim} scale={1.25} />
                <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>
                  {anim.toUpperCase()}
                </span>
              </div>
            ))}
          </div>

          <SectionLabel kicker="VITALS" right={guild.resource.name.toUpperCase()}>
            Kit at a glance
          </SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            <VitalTile label={guild.resource.name} value={String(guild.resource.max)} accent={accent} emphasized />
            <VitalTile label="HP" value={String(guild.hpMax)} />
            <VitalTile label="ARMOR" value={String(meta.uiVitals.Armor)} />
            <VitalTile label="MR" value={String(meta.uiVitals.MR)} />
            <VitalTile label="MOVE" value={String(meta.uiVitals.Move)} />
          </div>

          <SectionLabel kicker="STATS" right="6-AXIS">
            Attribute distribution
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {STAT_KEYS.map((k) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 32px', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 2 }}>
                  {k}
                </span>
                <MeterBar value={guild.stats[k]} max={STAT_MAX} color={accent} height={8} />
                <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: accent, textAlign: 'right' }}>
                  {guild.stats[k]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            padding: 32,
            borderLeft: `1px solid ${theme.lineSoft}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            overflow: 'auto',
          }}
        >
          <SectionLabel kicker="ABILITIES" right="5 COMBOS + RMB">
            Kit breakdown
          </SectionLabel>

          {guild.abilities.map((a, i) => (
            <div
              key={a.id}
              style={{
                padding: 14,
                background: theme.panel,
                border: `1px solid ${theme.lineSoft}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontFamily: theme.fontDisplay, fontSize: 18, color: accent }}>
                  <span style={{ color: theme.inkMuted, fontFamily: theme.fontMono, fontSize: 11, marginRight: 8 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {a.name}
                </span>
                <ComboDisplay combo={a.combo} size={13} />
              </div>
              <SpriteStrip guildId={guildId} animationId={`ability_${i + 1}`} scale={1.0} />
              <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkDim, lineHeight: 1.5 }}>
                {a.description || '—'}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {a.cost > 0 && <Chip mono>COST · {a.cost}</Chip>}
                {a.cooldownMs > 0 && <Chip mono>CD · {(a.cooldownMs / 1000).toFixed(a.cooldownMs < 10000 ? 1 : 0)}s</Chip>}
                {a.baseDamage > 0 && <Chip mono tone="warn">{a.baseDamage} {a.damageType.toUpperCase()}</Chip>}
                {a.isHeal && <Chip mono tone="good">HEAL</Chip>}
                {a.isProjectile && <Chip mono>PROJECTILE</Chip>}
                {a.isTeleport && <Chip mono>BLINK {a.teleportDist}</Chip>}
                {a.isChannel && <Chip mono>CHANNEL {(a.channelDurationMs / 1000).toFixed(1)}s</Chip>}
                {a.isGroundTarget && <Chip mono>GROUND</Chip>}
              </div>
            </div>
          ))}

          <div
            style={{
              padding: 14,
              background: theme.panel,
              border: `1px solid ${accent}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontFamily: theme.fontDisplay, fontSize: 18, color: accent }}>
                <span style={{ color: theme.inkMuted, fontFamily: theme.fontMono, fontSize: 11, marginRight: 8 }}>RMB</span>
                {guild.rmb.name}
              </span>
              <ComboDisplay combo={guild.rmb.combo} size={13} />
            </div>
            <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkDim, lineHeight: 1.5 }}>
              {guild.rmb.description || '—'}
            </div>
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
        <span>← → CYCLE GUILD</span>
        <span>ESC BACK</span>
      </div>
    </div>
  );
}

function VitalTile({ label, value, accent, emphasized }: { label: string; value: string; accent?: string; emphasized?: boolean }) {
  const fg = emphasized && accent ? accent : theme.ink;
  const border = emphasized && accent ? accent : theme.lineSoft;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px 6px',
        background: theme.panel,
        border: `1px solid ${border}`,
      }}
    >
      <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>
        {label.toUpperCase()}
      </span>
      <span style={{ fontFamily: theme.fontDisplay, fontSize: 22, color: fg, lineHeight: 1.1, marginTop: 2 }}>
        {value}
      </span>
    </div>
  );
}
