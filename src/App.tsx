import { useCallback, useEffect, useState } from 'react';
import type { MatchPhase } from '@nannymud/shared';
import { TitleScreen } from './screens/TitleScreen';
import { MainMenu } from './screens/MainMenu';
import { CharSelect } from './screens/CharSelect';
import { StageSelect } from './screens/StageSelect';
import { GameScreen } from './screens/GameScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { MoveList } from './screens/MoveList';
import { GuildDossier } from './screens/GuildDossier';
import { SettingsScreen } from './screens/SettingsScreen';
import { MpHub } from './screens/mp/MpHub';
import { MpLobby } from './screens/mp/MpLobby';
import { MpCharSelect } from './screens/mp/MpCharSelect';
import { MpStageSelect } from './screens/mp/MpStageSelect';
import { MpBattle } from './screens/mp/MpBattle';
import { MpLoadingScreen } from './screens/mp/MpLoadingScreen';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { ScalingFrame } from './layout/ScalingFrame';
import { Scanlines, theme } from './ui';
import { useAppState, type AppScreen } from './state/useAppState';
import type { MatchStats } from '@nannymud/shared/simulation/types';

const PHASE_TO_SCREEN: Record<MatchPhase, AppScreen> = {
  lobby: 'mp_lobby',
  char_select: 'mp_cs',
  stage_select: 'mp_stage',
  loading: 'mp_load',
  in_game: 'mp_battle',
  results: 'mp_results',
};

export default function App() {
  const { state, go, set } = useAppState();
  const [finalScore, setFinalScore] = useState(0);
  const [finalMatchStats, setFinalMatchStats] = useState<MatchStats | null>(null);

  // URL routing: /multiplayer → mp_hub on initial mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const guildParam = params.get('guild');
    const guildFromUrl = GUILDS.find((g) => g.id === guildParam)?.id;

    if (window.location.pathname === '/dossier' && state.screen === 'title') {
      go('guild_dossier', { guildId: guildFromUrl ?? 'viking' });
      return;
    }

    if (window.location.pathname === '/moves' && state.screen === 'title') {
      go('moves', guildFromUrl ? { guildId: guildFromUrl } : undefined);
      return;
    }

    if (window.location.pathname === '/multiplayer' && state.screen === 'title') {
      go('mp_hub');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tear down the Colyseus room when we navigate away from any MP screen.
  const isMpScreen =
    state.screen === 'mp_hub' ||
    state.screen === 'mp_lobby' ||
    state.screen === 'mp_cs' ||
    state.screen === 'mp_stage' ||
    state.screen === 'mp_load' ||
    state.screen === 'mp_battle' ||
    state.screen === 'mp_results';

  useEffect(() => {
    if (!isMpScreen && state.mpRoom) {
      state.mpRoom.leave().catch(() => {});
      set({ mpRoom: null });
    }
  }, [isMpScreen, state.mpRoom, set]);

  // Handle the server-initiated disconnect (room closed, kicked, etc.) —
  // bounce back to the hub. Local leave() calls also fire onLeave, but by
  // that point mpRoom has already been cleared so the handler is a no-op.
  useEffect(() => {
    const room = state.mpRoom;
    if (!room) return;
    const handler = () => {
      set({ mpRoom: null });
      go('mp_hub');
    };
    room.onLeave(handler);
    return () => {
      room.onLeave.remove(handler);
    };
  }, [state.mpRoom, set, go]);

  const onPhaseChange = useCallback(
    (phase: MatchPhase) => {
      const next = PHASE_TO_SCREEN[phase];
      if (next) go(next);
    },
    [go],
  );

  const leaveMp = useCallback(() => {
    const room = state.mpRoom;
    if (room) room.leave().catch(() => {});
    set({ mpRoom: null });
    go('mp_hub');
  }, [state.mpRoom, set, go]);

  return (
    <ScalingFrame>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: theme.bg,
          color: theme.ink,
          fontFamily: theme.fontBody,
          overflow: 'hidden',
        }}
      >
        {state.screen === 'title' && <TitleScreen onStart={() => go('menu')} />}

        {state.screen === 'menu' && (
          <MainMenu
            onPick={(target, mode) => {
              if (mode) set({ mode });
              go(target);
            }}
            difficulty={state.difficulty}
            onDifficultyChange={(d) => set({ difficulty: d })}
          />
        )}

        {state.screen === 'charselect' && (
          <CharSelect
            mode={state.mode}
            initialP1={state.p1}
            initialP2={state.p2}
            onBack={() => go('menu')}
            onReady={(p1, p2) => {
              set({ p1, p2 });
              go('stage');
            }}
          />
        )}

        {state.screen === 'stage' && (
          <StageSelect
            initialStage={state.stageId}
            onBack={() => go('charselect')}
            onReady={(stageId) => {
              set({ stageId });
              go('game');
            }}
          />
        )}

        {state.screen === 'game' && (
          <GameScreen
            mode={state.mode === 'vs' ? 'vs' : 'story'}
            p1={state.p1}
            p2={state.p2}
            stageId={state.stageId}
            animateHud={state.animateHud}
            difficulty={state.difficulty}
            onVictory={(score, matchStats) => {
              setFinalScore(score);
              setFinalMatchStats(matchStats);
              set({ winner: 'P1' });
              go('results');
            }}
            onDefeat={(matchStats) => {
              setFinalScore(0);
              setFinalMatchStats(matchStats);
              set({ winner: 'P2' });
              go('results');
            }}
            onQuit={() => go('menu')}
          />
        )}

        {state.screen === 'moves' && (
          <MoveList
            initialGuild={state.guildId}
            onBack={() => go('menu')}
            onDossier={(gid) => go('guild_dossier', { guildId: gid })}
          />
        )}

        {state.screen === 'guild_dossier' && (
          <GuildDossier
            guildId={state.guildId}
            onBack={() => go('moves')}
            onPrev={() => {
              const i = GUILDS.findIndex((g) => g.id === state.guildId);
              const next = GUILDS[(i - 1 + GUILDS.length) % GUILDS.length].id;
              set({ guildId: next });
            }}
            onNext={() => {
              const i = GUILDS.findIndex((g) => g.id === state.guildId);
              const next = GUILDS[(i + 1) % GUILDS.length].id;
              set({ guildId: next });
            }}
          />
        )}

        {state.screen === 'settings' && (
          <SettingsScreen
            animateHud={state.animateHud}
            onToggleAnimateHud={() => set({ animateHud: !state.animateHud })}
            onBack={() => go('menu')}
          />
        )}

        {state.screen === 'results' && (
          <ResultsScreen
            p1={state.p1}
            p2={state.p2}
            winner={state.winner ?? 'P2'}
            score={finalScore}
            matchStats={finalMatchStats ?? undefined}
            onRematch={() => go('game')}
            onMenu={() => go('menu')}
          />
        )}

        {state.screen === 'mp_hub' && (
          <MpHub
            onBack={() => go('menu')}
            onHosted={(room) => {
              set({ mpRoom: room });
              go('mp_lobby');
            }}
            onJoined={(room) => {
              set({ mpRoom: room });
              go('mp_lobby');
            }}
          />
        )}

        {state.screen === 'mp_lobby' && state.mpRoom && (
          <MpLobby
            room={state.mpRoom}
            onLeave={leaveMp}
            onPhaseChange={onPhaseChange}
          />
        )}

        {state.screen === 'mp_cs' && state.mpRoom && (
          <MpCharSelect
            room={state.mpRoom}
            onLeave={leaveMp}
            onPhaseChange={onPhaseChange}
          />
        )}

        {state.screen === 'mp_stage' && state.mpRoom && (
          <MpStageSelect
            room={state.mpRoom}
            onLeave={leaveMp}
            onPhaseChange={onPhaseChange}
          />
        )}

        {state.screen === 'mp_battle' && state.mpRoom && (
          <MpBattle
            room={state.mpRoom}
            animateHud={state.animateHud}
            onLeave={leaveMp}
            onPhaseChange={onPhaseChange}
          />
        )}

        {state.screen === 'mp_load' && state.mpRoom && (
          <MpLoadingScreen
            room={state.mpRoom}
            onPhaseChange={onPhaseChange}
          />
        )}

        {/* mp_results still stubbed until Phase F wraps.
            Also catches any orphaned MP screen (no room after a refresh)
            and offers a back-to-hub affordance. */}
        {isMpScreen &&
          state.screen !== 'mp_hub' &&
          (state.screen === 'mp_results' ||
            (state.screen !== 'mp_battle' &&
              state.screen !== 'mp_load' &&
              !state.mpRoom)) && (
            <MpStub screen={state.screen} onLeave={leaveMp} />
          )}

        <Scanlines />
      </div>
    </ScalingFrame>
  );
}

interface MpStubProps {
  screen: AppScreen;
  onLeave: () => void;
}

function MpStub({ screen, onLeave }: MpStubProps) {
  const label =
    screen === 'mp_load'
      ? 'LOADING BATTLE…'
      : screen === 'mp_battle'
      ? 'IN BATTLE (Phase F)'
      : screen === 'mp_results'
      ? 'RESULTS (Phase F)'
      : 'NO ROOM';
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
      }}
    >
      <div
        style={{
          fontFamily: theme.fontDisplay,
          fontSize: 32,
          color: theme.ink,
          letterSpacing: '-0.02em',
        }}
      >
        {label}
      </div>
      <button
        onClick={onLeave}
        style={{
          padding: '12px 24px',
          background: 'transparent',
          color: theme.ink,
          border: `1px solid ${theme.line}`,
          fontFamily: theme.fontMono,
          fontSize: 13,
          letterSpacing: 3,
          cursor: 'pointer',
          borderRadius: 2,
        }}
      >
        ← BACK TO HUB
      </button>
    </div>
  );
}

