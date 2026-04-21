import { useState } from 'react';
import { TitleScreen } from './screens/TitleScreen';
import { MainMenu } from './screens/MainMenu';
import { CharSelect } from './screens/CharSelect';
import { GameScreen } from './screens/GameScreen';
import { GameOverScreen } from './screens/GameOverScreen';
import { ScalingFrame } from './layout/ScalingFrame';
import { Scanlines, theme } from './ui';
import { useAppState } from './state/useAppState';

export default function App() {
  const { state, go, set } = useAppState();
  const [outcome, setOutcome] = useState<'victory' | 'defeat'>('defeat');
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
              go('game');
            }}
          />
        )}

        {state.screen === 'game' && (
          <GameScreen
            guildId={state.p1}
            onVictory={(score) => {
              setOutcome('victory');
              setFinalScore(score);
              go('results');
            }}
            onDefeat={() => {
              setOutcome('defeat');
              go('results');
            }}
            onQuit={() => go('menu')}
          />
        )}

        {state.screen === 'results' && (
          <GameOverScreen
            outcome={outcome}
            score={finalScore}
            onRetry={() => go('game')}
            onMenu={() => go('menu')}
          />
        )}

        <Scanlines />
      </div>
    </ScalingFrame>
  );
}
