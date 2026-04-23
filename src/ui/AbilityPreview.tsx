import type { GuildId } from '@nannymud/shared/simulation/types';
import { SpriteStrip } from './SpriteStrip';
import { VfxStrip } from './VfxStrip';

interface Props {
  guildId: GuildId;
  abilityId: string;
  animationId: string;
  spriteScale?: number;
  vfxScale?: number;
}

type AbilityPreviewSpec =
  | { kind: 'sprite' }
  | { kind: 'vfx'; assetKey: string };

function getAbilityPreviewSpec(guildId: GuildId, abilityId: string): AbilityPreviewSpec {
  switch (guildId) {
    case 'knight':
      switch (abilityId) {
        case 'holy_rebuke': return { kind: 'vfx', assetKey: 'holy_rebuke_burst' };
        case 'valorous_strike': return { kind: 'vfx', assetKey: 'valorous_strike_impact' };
        case 'taunt': return { kind: 'vfx', assetKey: 'taunt_shout' };
        case 'shield_wall': return { kind: 'vfx', assetKey: 'shield_wall_barrier' };
        case 'last_stand': return { kind: 'vfx', assetKey: 'last_stand_aura' };
        default: return { kind: 'sprite' };
      }
    case 'leper':
      switch (abilityId) {
        case 'plague_vomit': return { kind: 'vfx', assetKey: 'plague_vomit_burst' };
        case 'diseased_claw': return { kind: 'vfx', assetKey: 'diseased_claw_impact' };
        case 'necrotic_embrace': return { kind: 'vfx', assetKey: 'necrotic_embrace_drain' };
        case 'rotting_tide': return { kind: 'vfx', assetKey: 'rotting_tide_burst' };
        default: return { kind: 'sprite' };
      }
    case 'viking':
      switch (abilityId) {
        case 'whirlwind': return { kind: 'sprite' };
        case 'axe_swing': return { kind: 'vfx', assetKey: 'axe_swing_impact' };
        case 'bloodlust': return { kind: 'sprite' };
        case 'shield_bash': return { kind: 'vfx', assetKey: 'shield_bash_impact' };
        case 'undying_rage': return { kind: 'sprite' };
        default: return { kind: 'sprite' };
      }
    default:
      return { kind: 'sprite' };
  }
}

export function AbilityPreview({
  guildId,
  abilityId,
  animationId,
  spriteScale = 1.1,
  vfxScale = 1.35,
}: Props) {
  const preview = getAbilityPreviewSpec(guildId, abilityId);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {preview.kind === 'sprite' ? (
        <SpriteStrip guildId={guildId} animationId={animationId} scale={spriteScale} />
      ) : (
        <VfxStrip guildId={guildId} assetKey={preview.assetKey} scale={vfxScale} />
      )}
    </div>
  );
}
