import { useState } from 'react';
import { TitleScreen } from './screens/TitleScreen';
import { MainMenu } from './screens/MainMenu';
import { CharSelect } from './screens/CharSelect';
import { StageSelect } from './screens/StageSelect';
import { LoadingScreen } from './screens/LoadingScreen';
import { GameScreen } from './screens/GameScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { ScalingFrame } from './layout/ScalingFrame';
import { Scanlines, theme } from './ui';
import { useAppState } from './state/useAppState';

export default function App() {
  const { state, go, set } = useAppState();
  const [finalScore, setFinalScore] = useState(0);

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
              go('loading');
            }}
          />
        )}

        {state.screen === 'loading' && (
          <LoadingScreen
            p1={state.p1}
            p2={state.p2}
            stageId={state.stageId}
            showOpponent={state.mode === 'vs'}
            onDone={() => go('game')}
          />
        )}

        {state.screen === 'game' && (
          <GameScreen
            guildId={state.p1}
            onVictory={(score) => {
              setFinalScore(score);
              set({ winner: 'P1' });
              go('results');
            }}
            onDefeat={() => {
              setFinalScore(0);
              set({ winner: 'P2' });
              go('results');
            }}
            onQuit={() => go('menu')}
          />
        )}

        {state.screen === 'results' && (
          <ResultsScreen
            p1={state.p1}
            p2={state.p2}
            winner={state.winner ?? 'P2'}
            score={finalScore}
            onRematch={() => go('loading')}
            onMenu={() => go('menu')}
          />
        )}

        <Scanlines />
      </div>
    </ScalingFrame>
  );
}
