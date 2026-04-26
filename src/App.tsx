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
import { MpBattleConfig } from './screens/mp/MpBattleConfig';
import { MpCharSelect } from './screens/mp/MpCharSelect';
import { MpStageSelect } from './screens/mp/MpStageSelect';
import { MpBattle } from './screens/mp/MpBattle';
import { MpLoadingScreen } from './screens/mp/MpLoadingScreen';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { getMatchSlots } from './screens/mp/useMatchState';
import { ScalingFrame } from './layout/ScalingFrame';
import { Scanlines, theme } from './ui';
import { useAppState, type AppScreen } from './state/useAppState';
import type { GuildId, MatchStats, BattStatEntry } from '@nannymud/shared/simulation/types';
import { BattleConfigScreen } from './screens/BattleConfigScreen';
import { BattleResultsScreen } from './screens/BattleResultsScreen';
import { MobileWelcome } from './screens/MobileWelcome';
import { initChampionship, advanceBracket, getOpponent } from './state/championship';
import { ChampBracketScreen } from './screens/ChampBracketScreen';
import { ChampTransitionScreen } from './screens/ChampTransitionScreen';
import { ChampResultsScreen } from './screens/ChampResultsScreen';
import { SurvivalResultsScreen } from './screens/SurvivalResultsScreen';
import { parseDebugParams, buildDebugState } from './state/debugRouter';

const PHASE_TO_SCREEN: Record<MatchPhase, AppScreen> = {
  lobby: 'mp_lobby',
  char_select: 'mp_cs',
  stage_select: 'mp_stage',
  loading: 'mp_load',
  in_game: 'mp_battle',
  results: 'mp_results',
  battle_config: 'mp_battle_config',
};

export default function App() {
  const { state, go, set } = useAppState();
  const [finalScore, setFinalScore] = useState(0);
  const [finalMatchStats, setFinalMatchStats] = useState<MatchStats | null>(null);
  const [mpMatchStats, setMpMatchStats] = useState<MatchStats | null>(null);
  const [battlePlayerWon, setBattlePlayerWon] = useState(false);
  const [finalBattStats, setFinalBattStats] = useState<Record<string, BattStatEntry> | null>(null);
  const [champPrevRound, setChampPrevRound] = useState<0 | 1 | 2>(0);
  const [champPlayerWon, setChampPlayerWon] = useState(false);

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
      return;
    }

    // ?screen=<AppScreen> debug deep-link — seeds every screen with realistic mocked state.
    const intent = parseDebugParams(params);
    if (intent) {
      const r = buildDebugState(intent);
      go(r.screen);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set(r.stateFields as any);
      if (r.finalScore !== undefined) setFinalScore(r.finalScore);
      if (r.finalMatchStats !== undefined) setFinalMatchStats(r.finalMatchStats);
      if (r.battlePlayerWon !== undefined) setBattlePlayerWon(r.battlePlayerWon);
      if (r.finalBattStats !== undefined) setFinalBattStats(r.finalBattStats);
      if (r.champPrevRound !== undefined) setChampPrevRound(r.champPrevRound);
      if (r.champPlayerWon !== undefined) setChampPlayerWon(r.champPlayerWon);
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
    state.screen === 'mp_results' ||
    state.screen === 'mp_battle_config';

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

  // Capture match stats broadcast by the server when the match ends.
  useEffect(() => {
    const room = state.mpRoom;
    if (!room) return;
    setMpMatchStats(null);
    room.onMessage('match_result', (msg: { matchStats: MatchStats }) => {
      setMpMatchStats(msg.matchStats);
    });
  }, [state.mpRoom]);

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
    <>
    <MobileWelcome />
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
              if (state.mode === 'batt') {
                go('battleconfig');
              } else if (state.mode === 'champ') {
                set({ championshipState: initChampionship(p1, Date.now()) });
                go('champbracket');
              } else {
                go('stage');
              }
            }}
          />
        )}

        {state.screen === 'battleconfig' && (
          <BattleConfigScreen
            humanGuildId={state.p1}
            onBack={() => go('charselect')}
            onReady={(slots) => {
              set({ battleSlots: slots });
              go('stage');
            }}
          />
        )}

        {state.screen === 'stage' && (
          <StageSelect
            initialStage={state.stageId}
            onBack={() => {
              if (state.mode === 'champ') go('champbracket');
              else go('charselect');
            }}
            onReady={(stageId) => {
              if (state.mode === 'champ' && state.championshipState) {
                set({ stageId, p2: getOpponent(state.championshipState) });
              } else {
                set({ stageId });
              }
              go('game');
            }}
          />
        )}

        {state.screen === 'game' && (
          <GameScreen
            mode={state.mode === 'vs' || state.mode === 'champ' ? 'vs' : 'story'}
            p1={state.p1}
            p2={state.p2}
            stageId={state.stageId}
            animateHud={state.animateHud}
            difficulty={state.mode === 'batt' ? state.battleDifficulty : state.mode === 'champ' ? state.champDifficulty : state.vsDifficulty}
            battleMode={state.mode === 'batt'}
            battleSlots={state.mode === 'batt' ? state.battleSlots : undefined}
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
            onBattleEnd={(playerWon, battStats) => {
              setBattlePlayerWon(playerWon);
              setFinalBattStats(battStats ?? null);
              go('battresults');
            }}
            survivalMode={state.mode === 'surv'}
            onSurvivalEnd={(score, wave) => {
              set({ survivalScore: score, survivalWave: wave });
              go('survresults');
            }}
            onChampEnd={state.mode === 'champ' ? (playerWon) => {
              if (!state.championshipState) return;
              const prevRound = state.championshipState.currentRound as 0 | 1 | 2;
              const advanced = advanceBracket(state.championshipState, playerWon);
              setChampPrevRound(prevRound);
              setChampPlayerWon(playerWon);
              set({ championshipState: advanced });
              go('champtransition');
            } : undefined}
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
            vsDifficulty={state.vsDifficulty}
            champDifficulty={state.champDifficulty}
            battleDifficulty={state.battleDifficulty}
            onVsDifficultyChange={(d) => set({ vsDifficulty: d })}
            onChampDifficultyChange={(d) => set({ champDifficulty: d })}
            onBattleDifficultyChange={(d) => set({ battleDifficulty: d })}
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

        {state.screen === 'battresults' && (
          <BattleResultsScreen
            slots={state.battleSlots}
            battStats={finalBattStats}
            playerWon={battlePlayerWon}
            onRematch={() => go('game')}
            onMenu={() => go('menu')}
          />
        )}

        {state.screen === 'survresults' && (
          <SurvivalResultsScreen
            guildId={state.p1}
            score={state.survivalScore}
            wave={state.survivalWave}
            onRetry={() => go('game')}
            onMenu={() => go('menu')}
          />
        )}

        {state.screen === 'champbracket' && state.championshipState && (
          <ChampBracketScreen
            champ={state.championshipState}
            onFight={() => go('stage')}
            onQuit={() => { set({ championshipState: null }); go('menu'); }}
          />
        )}

        {state.screen === 'champtransition' && state.championshipState && (
          <ChampTransitionScreen
            champ={state.championshipState}
            prevRound={champPrevRound}
            playerWon={champPlayerWon}
            onAdvance={() => go('champbracket')}
            onResults={() => go('champresults')}
          />
        )}

        {state.screen === 'champresults' && state.championshipState && (
          <ChampResultsScreen
            champ={state.championshipState}
            onPlayAgain={() => { set({ championshipState: null }); go('charselect'); }}
            onMenu={() => { set({ championshipState: null }); go('menu'); }}
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

        {state.screen === 'mp_results' && state.mpRoom && (() => {
          const room = state.mpRoom;
          const rstate = room.state;
          const { localSlot, opponentSlot } = getMatchSlots(rstate, room.sessionId);
          const localGuild = (localSlot?.guildId as GuildId | undefined) ?? 'adventurer';
          const oppGuild = (opponentSlot?.guildId as GuildId | undefined) ?? 'knight';
          const localWon = rstate.matchWinnerSessionId === room.sessionId;
          const localIsHost = room.sessionId === rstate.hostSessionId;
          let adjustedStats: MatchStats | undefined;
          if (mpMatchStats) {
            const localStats = localIsHost ? mpMatchStats.p1 : mpMatchStats.p2;
            const oppStats = localIsHost ? mpMatchStats.p2 : mpMatchStats.p1;
            adjustedStats = { p1: localStats, p2: oppStats };
          }
          return (
            <ResultsScreen
              p1={localGuild}
              p2={oppGuild}
              winner={localWon ? 'P1' : 'P2'}
              score={0}
              matchStats={adjustedStats}
              onRematch={() => room.send('rematch_offer', {})}
              onMenu={leaveMp}
            />
          );
        })()}

        {state.screen === 'mp_battle_config' && state.mpRoom && (
          <MpBattleConfig
            room={state.mpRoom}
            onLeave={leaveMp}
            onPhaseChange={onPhaseChange}
          />
        )}

        {/* Fallback stub for orphaned MP screens (no room after a refresh). */}
        {isMpScreen &&
          state.screen !== 'mp_hub' &&
          (state.screen !== 'mp_results' || !state.mpRoom) &&
          state.screen !== 'mp_battle' &&
          state.screen !== 'mp_load' &&
          state.screen !== 'mp_battle_config' &&
          !state.mpRoom && (
            <MpStub screen={state.screen} onLeave={leaveMp} />
          )}

        <Scanlines />
      </div>
    </ScalingFrame>
    </>
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
      : screen === 'mp_battle_config'
      ? 'BATTLE CONFIG (Phase F)'
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

