import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { GUILD_META } from '../data/guildMeta';
import type { GuildId, AbilityDef } from '@nannymud/shared/simulation/types';
import { theme, guildAccent, ModalShell, SpriteStrip, ComboDisplay } from '../ui';

interface Props {
  guildId: GuildId;
  onClose: () => void;
}

const ABILITY_ANIM_IDS = ['ability_1', 'ability_2', 'ability_3', 'ability_4', 'ability_5'] as const;

export function GuildDetails({ guildId, onClose }: Props) {
  const guild = GUILDS.find((g) => g.id === guildId)!;
  const meta = GUILD_META[guildId];
  const accent = guildAccent(meta.hue);

  return (
    <ModalShell title={guild.name} kicker={`GUILD · ${meta.tag}`} onCancel={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <div
              style={{
                background: theme.panel,
                border: `1px solid ${theme.lineSoft}`,
                padding: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: 90,
                boxSizing: 'border-box',
              }}
            >
              <SpriteStrip guildId={guildId} animationId="idle" scale={1.1} />
            </div>
            <div style={{ fontFamily: theme.fontBody, fontSize: 11, color: theme.inkDim, fontStyle: 'italic', textAlign: 'center' }}>
              {meta.sub}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: theme.fontBody, fontSize: 14, color: theme.inkDim, lineHeight: 1.55 }}>
              {meta.bio}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              <VitalChip label={guild.resource.name} value={String(guild.resource.max)} accent={accent} emphasized />
              <VitalChip label="HP" value={String(guild.hpMax)} />
              <VitalChip label="ARMOR" value={String(meta.uiVitals.Armor)} />
              <VitalChip label="MR" value={String(meta.uiVitals.MR)} />
              <VitalChip label="MOVE" value={String(meta.uiVitals.Move)} />
            </div>
          </div>
        </div>

        <div
          style={{
            fontFamily: theme.fontMono,
            fontSize: 11,
            color: theme.inkMuted,
            letterSpacing: 3,
            borderBottom: `1px solid ${theme.lineSoft}`,
            paddingBottom: 6,
          }}
        >
          ABILITIES
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {guild.abilities.map((ability, i) => (
            <AbilityCard
              key={ability.id}
              ability={ability}
              guildId={guildId}
              animationId={ABILITY_ANIM_IDS[i]}
              accent={accent}
            />
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

interface VitalChipProps {
  label: string;
  value: string;
  accent?: string;
  emphasized?: boolean;
}

function VitalChip({ label, value, accent, emphasized }: VitalChipProps) {
  const fg = emphasized && accent ? accent : theme.ink;
  const border = emphasized && accent ? accent : theme.lineSoft;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 8px',
        background: theme.panel,
        border: `1px solid ${border}`,
      }}
    >
      <span
        style={{
          fontFamily: theme.fontMono,
          fontSize: 10,
          color: theme.ink,
          letterSpacing: 2,
        }}
      >
        {label.toUpperCase()}
      </span>
      <span
        style={{
          fontFamily: theme.fontDisplay,
          fontSize: 24,
          color: fg,
          lineHeight: 1.1,
          marginTop: 2,
        }}
      >
        {value}
      </span>
    </div>
  );
}

interface AbilityCardProps {
  ability: AbilityDef;
  guildId: GuildId;
  animationId: string;
  accent: string;
}

function AbilityCard({ ability, guildId, animationId, accent }: AbilityCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: 8,
        background: theme.panel,
        border: `1px solid ${theme.lineSoft}`,
      }}
    >
      <div
        style={{
          background: theme.bgDeep,
          border: `1px solid ${theme.lineSoft}`,
          padding: 4,
          flexShrink: 0,
          width: 86,
          height: 86,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SpriteStrip guildId={guildId} animationId={animationId} scale={1.15} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 16, color: accent, lineHeight: 1.15 }}>{ability.name}</div>
        <ComboDisplay combo={ability.combo} size={14} />
        <div style={{ fontFamily: theme.fontBody, fontSize: 12, color: theme.inkDim, lineHeight: 1.45 }}>
          {ability.description}
        </div>
      </div>
    </div>
  );
}

