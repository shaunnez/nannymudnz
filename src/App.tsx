import { useState } from 'react';
import { TitleScreen } from './screens/TitleScreen';
import { GuildSelect } from './screens/GuildSelect';
import { GameScreen } from './screens/GameScreen';
import { GameOverScreen } from './screens/GameOverScreen';
import { ScalingFrame } from './layout/ScalingFrame';
import type { GuildId } from './simulation/types';

type AppScreen = 'title' | 'guild_select' | 'game' | 'game_over';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('title');
  const [selectedGuild, setSelectedGuild] = useState<GuildId>('adventurer');
  const [outcome, setOutcome] = useState<'victory' | 'defeat'>('defeat');
  const [finalScore, setFinalScore] = useState(0);

  return (
    <ScalingFrame>
      {screen === 'title' && (
        <TitleScreen onStart={() => setScreen('guild_select')} />
      )}
      {screen === 'guild_select' && (
        <GuildSelect
          onSelect={(guildId) => {
            setSelectedGuild(guildId);
            setScreen('game');
          }}
        />
      )}
      {screen === 'game' && (
        <GameScreen
          guildId={selectedGuild}
          onVictory={(score) => {
            setOutcome('victory');
            setFinalScore(score);
            setScreen('game_over');
          }}
          onDefeat={() => {
            setOutcome('defeat');
            setScreen('game_over');
          }}
          onQuit={() => setScreen('guild_select')}
        />
      )}
      {screen === 'game_over' && (
        <GameOverScreen
          outcome={outcome}
          score={finalScore}
          onRetry={() => setScreen('game')}
          onMenu={() => setScreen('guild_select')}
        />
      )}
    </ScalingFrame>
  );
}
