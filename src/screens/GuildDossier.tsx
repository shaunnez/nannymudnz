import { useEffect, useMemo, useState } from 'react';
import { GUILDS, DRUID_WOLF_ABILITIES, DRUID_WOLF_RMB } from '@nannymud/shared/simulation/guildData';
import { GUILD_META } from '../data/guildMeta';
import type { GuildId, Stats, AbilityDef } from '@nannymud/shared/simulation/types';
import { theme, guildAccent, Btn, Chip, SectionLabel, GuildMonogram, SpriteStrip, ComboDisplay, MeterBar, AbilityPreview } from '../ui';
import { useIsMobile } from '../hooks/useIsMobile';

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
  const mobile = useIsMobile();

  const [druidForm, setDruidForm] = useState<'druid' | 'wolf'>('druid');
  useEffect(() => { setDruidForm('druid'); }, [guildId]);

  const abilityEntries = useMemo(
    () => {
      if (guildId === 'druid' && druidForm === 'wolf') {
        return [
          ...DRUID_WOLF_ABILITIES.map((a, i) => ({ ability: a, slot: String(i + 1).padStart(2, '0'), isRmb: false })),
          { ability: DRUID_WOLF_RMB, slot: '06', isRmb: true },
        ];
      }
      return [
        ...guild.abilities.map((a, i) => ({ ability: a, slot: String(i + 1).padStart(2, '0'), isRmb: false })),
        { ability: guild.rmb, slot: '06', isRmb: true },
      ];
    },
    [guild, guildId, druidForm],
  );
  const [abilityIdx, setAbilityIdx] = useState(0);
  useEffect(() => { setAbilityIdx(0); }, [guildId, druidForm]);
  const currentAbility = abilityEntries[Math.min(abilityIdx, abilityEntries.length - 1)];

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
            padding: mobile ? 20 : 40,
            display: 'flex',
            flexDirection: 'column',
            gap: mobile ? 8 : 16,
            background: `linear-gradient(180deg, ${accent}16, transparent 70%)`,
            overflow: 'auto',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 18, alignItems: 'center' }}>
            <GuildMonogram guildId={guildId} size={80} selected />
            <div>
              <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 5 }}>
                {meta.tag.toUpperCase()}
              </div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: mobile ? 30 : 44, color: theme.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>
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
                  padding: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <div style={{ height: mobile ? 56 : 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SpriteStrip guildId={guildId} animationId={anim} targetHeight={mobile ? 48 : 80} />
                </div>
                <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>
                  {anim.toUpperCase()}
                </span>
              </div>
            ))}
          </div>

          <SectionLabel kicker="VITALS" right={guild.resource.name.toUpperCase()}>
            Kit at a glance
          </SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: mobile ? 4 : 8 }}>
            <VitalTile label={guild.resource.name} value={String(guild.resource.max)} accent={accent} emphasized mobile={mobile} />
            <VitalTile label="HP" value={String(guild.hpMax)} mobile={mobile} />
            <VitalTile label="ARMOR" value={String(meta.uiVitals.Armor)} mobile={mobile} />
            <VitalTile label="MR" value={String(meta.uiVitals.MR)} mobile={mobile} />
            <VitalTile label="MOVE" value={String(meta.uiVitals.Move)} mobile={mobile} />
          </div>

          <SectionLabel kicker="STATS" right="6-AXIS">
            Attribute distribution
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {STAT_KEYS.map((k) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 48px', alignItems: 'center', gap: 14 }}>
                <span style={{ fontFamily: theme.fontMono, fontSize: 14, color: theme.inkMuted, letterSpacing: 3 }}>
                  {k}
                </span>
                <MeterBar value={guild.stats[k]} max={STAT_MAX} color={accent} height={10} />
                <span style={{ fontFamily: theme.fontMono, fontSize: 16, color: accent, textAlign: 'right', letterSpacing: 1 }}>
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
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <SectionLabel kicker={guildId === 'druid' && druidForm === 'wolf' ? 'WOLF FORM' : 'ABILITIES'} right={`${abilityIdx + 1} / ${abilityEntries.length}`}>
                Kit breakdown
              </SectionLabel>
            </div>
            {guildId === 'druid' && (['druid', 'wolf'] as const).map((form) => (
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
                  fontSize: 10,
                  letterSpacing: 2,
                  padding: '5px 10px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {form === 'druid' ? 'DRUID' : 'WOLF'}
              </button>
            ))}
          </div>

          <AbilityPager
            entry={currentAbility}
            guildId={guildId}
            abilityIndex={abilityIdx}
            accent={accent}
            spriteGuildId={guildId === 'druid' && druidForm === 'wolf' ? 'wolf' : undefined}
          />

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 'auto' }}>
            {abilityEntries.map((e, i) => {
              const act = i === abilityIdx;
              return (
                <button
                  key={e.slot}
                  type="button"
                  onClick={() => setAbilityIdx(i)}
                  style={{
                    appearance: 'none',
                    border: `1px solid ${act ? accent : theme.lineSoft}`,
                    background: act ? `${accent}18` : theme.panel,
                    color: act ? accent : theme.inkDim,
                    fontFamily: theme.fontMono,
                    fontSize: 10,
                    letterSpacing: 2,
                    padding: '6px 10px',
                    cursor: 'pointer',
                  }}
                >
                  {e.slot}
                </button>
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
        <span>← → CYCLE GUILD</span>
        <span>ESC BACK</span>
      </div>
    </div>
  );
}

interface AbilityEntry { ability: AbilityDef; slot: string; isRmb: boolean; }

const WOLF_DOSSIER_ANIM: Record<number, string> = { 0: 'attack_1', 1: 'run', 2: 'idle', 3: 'attack_1', 4: 'idle' };

function AbilityPager({
  entry,
  guildId,
  abilityIndex,
  accent,
  spriteGuildId,
}: {
  entry: AbilityEntry;
  guildId: GuildId;
  abilityIndex: number;
  accent: string;
  spriteGuildId?: string;
}) {
  const { ability: a, slot, isRmb } = entry;
  const animId = spriteGuildId
    ? (isRmb ? 'idle' : (WOLF_DOSSIER_ANIM[abilityIndex] ?? 'idle'))
    : isRmb ? 'attack_2' : `ability_${abilityIndex + 1}`;
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        background: theme.panel,
        border: `1px solid ${isRmb ? accent : theme.lineSoft}`,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 3 }}>
            SLOT · {slot}
          </span>
          <span style={{ fontFamily: theme.fontDisplay, fontSize: 30, color: accent, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
            {a.name}
          </span>
        </div>
        <ComboDisplay combo={a.combo} size={16} />
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: theme.bgDeep,
          border: `1px solid ${theme.lineSoft}`,
          padding: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <AbilityPreview guildId={guildId} abilityId={a.id} animationId={animId} spriteScale={2.2} vfxScale={1.7} spriteGuildId={spriteGuildId} />
      </div>

      <div style={{ fontFamily: theme.fontBody, fontSize: 16, color: theme.inkDim, lineHeight: 1.6 }}>
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
  );
}

function VitalTile({ label, value, accent, emphasized, mobile }: { label: string; value: string; accent?: string; emphasized?: boolean; mobile?: boolean }) {
  const fg = emphasized && accent ? accent : theme.ink;
  const border = emphasized && accent ? accent : theme.lineSoft;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: mobile ? '6px 4px' : '10px 6px',
        background: theme.panel,
        border: `1px solid ${border}`,
      }}
    >
      <span style={{ fontFamily: theme.fontMono, fontSize: mobile ? 9 : 14, color: theme.inkMuted, letterSpacing: 2 }}>
        {label.toUpperCase()}
      </span>
      <span style={{ fontFamily: theme.fontDisplay, fontSize: mobile ? 15 : 22, color: fg, lineHeight: 1.1, marginTop: 2 }}>
        {value}
      </span>
    </div>
  );
}
