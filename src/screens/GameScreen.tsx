import { useEffect, useRef } from 'react';
import type { GuildId } from '../simulation/types';
import { createInitialState, tickSimulation, resetController } from '../simulation/simulation';
import { createComboBuffer } from '../simulation/comboBuffer';
import { GameRenderer } from '../rendering/gameRenderer';
import { InputManager } from '../input/inputManager';
import { loadKeyBindings } from '../input/keyBindings';
import { AudioManager } from '../audio/audioManager';

interface Props {
  guildId: GuildId;
  onVictory: (score: number) => void;
  onDefeat: () => void;
  onQuit: () => void;
}

export function GameScreen({ guildId, onVictory, onDefeat, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(createInitialState(guildId));
  const rendererRef = useRef(new GameRenderer());
  const inputRef = useRef<InputManager | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const comboBufferRef = useRef(createComboBuffer());
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const bossWasMusicStarted = useRef(false);

  const onQuitRef = useRef(onQuit);
  const onVictoryRef = useRef(onVictory);
  const onDefeatRef = useRef(onDefeat);

  useEffect(() => { onQuitRef.current = onQuit; }, [onQuit]);
  useEffect(() => { onVictoryRef.current = onVictory; }, [onVictory]);
  useEffect(() => { onDefeatRef.current = onDefeat; }, [onDefeat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const bindings = loadKeyBindings();
    const input = new InputManager(bindings);
    inputRef.current = input;

    const audio = new AudioManager();
    audioRef.current = audio;

    stateRef.current = createInitialState(guildId);
    comboBufferRef.current = createComboBuffer();
    resetController('player');
    bossWasMusicStarted.current = false;

    audio.startStageMusic();

    const gameLoop = (timestamp: number) => {
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dtMs = Math.min(50, timestamp - (lastTimeRef.current || timestamp));
      lastTimeRef.current = timestamp;

      const inputState = input.getInputState(stateRef.current.timeMs + dtMs);

      const prevPhase = stateRef.current.phase;
      stateRef.current = tickSimulation(stateRef.current, inputState, dtMs);
      const state = stateRef.current;

      input.clearJustPressed();

      if (!bossWasMusicStarted.current && state.bossSpawned) {
        bossWasMusicStarted.current = true;
        audio.startBossMusic();
      }

      if (prevPhase === 'playing' && state.phase === 'victory') {
        audio.stopMusic();
        audio.playVictory();
        setTimeout(() => onVictoryRef.current(state.score), 1500);
        return;
      }

      if (prevPhase === 'playing' && state.phase === 'defeat') {
        audio.stopMusic();
        audio.playDefeat();
        setTimeout(() => onDefeatRef.current(), 1500);
        return;
      }

      const vfx = state.vfxEvents;
      if (vfx.some(e => e.type === 'hit_spark')) audio.playAttack();
      if (vfx.some(e => e.type === 'heal_glow')) audio.playHeal();
      if (state.player.state === 'blocking') audio.playBlock();
      if (state.player.state === 'jumping' && state.player.z < 10 && inputState.jumpJustPressed) audio.playJump();

      rendererRef.current.render(
        ctx,
        state,
        comboBufferRef.current,
        canvas.width,
        canvas.height,
        dtMs,
      );

      if (state.phase === 'playing' || state.phase === 'paused') {
        animFrameRef.current = requestAnimationFrame(gameLoop);
      }
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      input.dispose();
      audio.dispose();
      resetController('player');
    };
  }, [guildId]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: '#000000',
      minHeight: '100vh',
      justifyContent: 'center',
    }}>
      <canvas
        ref={canvasRef}
        width={900}
        height={500}
        style={{
          width: '100%',
          maxWidth: 900,
          height: 'auto',
          display: 'block',
          imageRendering: 'crisp-edges',
        }}
        tabIndex={0}
      />
      <div style={{
        display: 'flex',
        gap: 16,
        padding: '8px 16px',
        background: '#0f172a',
        width: '100%',
        maxWidth: 900,
        boxSizing: 'border-box',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ color: '#6b7280', fontSize: 11 }}>
          ← → ↑ ↓ Move &nbsp;|&nbsp; Space Jump &nbsp;|&nbsp; J Attack &nbsp;|&nbsp; K Block &nbsp;|&nbsp; L Grab &nbsp;|&nbsp; Esc Pause
        </div>
        <button
          onClick={onQuit}
          style={{
            background: 'transparent',
            border: '1px solid #374151',
            color: '#9ca3af',
            padding: '4px 12px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Quit
        </button>
      </div>
    </div>
  );
}
