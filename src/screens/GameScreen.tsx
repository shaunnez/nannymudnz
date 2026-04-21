import { useEffect, useRef, type MouseEvent } from 'react';
import type { GuildId } from '../simulation/types';
import { createInitialState, tickSimulation, resetController, forcePause } from '../simulation/simulation';
import { createComboBuffer } from '../simulation/comboBuffer';
import { useFullscreen } from '../layout/useFullscreen';
import { FULLSCREEN_EXIT_EVENT } from '../layout/fullscreenConstants';
import { GameRenderer } from '../rendering/gameRenderer';
import { loadGuildSpriteSet } from '../rendering/sprite/spriteLoader';
import { SpriteActorRenderer } from '../rendering/sprite/spriteActorRenderer';
import { hitTestHudButton } from '../rendering/hudButtons';
import {
  CANVAS_BUFFER_WIDTH,
  CANVAS_BUFFER_HEIGHT,
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
  RENDER_SCALE,
} from '../rendering/constants';
import { InputManager } from '../input/inputManager';
import { loadKeyBindings } from '../input/keyBindings';
import { AudioManager } from '../audio/audioManager';

interface Props {
  guildId: GuildId;
  onVictory: (score: number) => void;
  onDefeat: () => void;
  onQuit: () => void;
}

const SPRITE_FLAG_KEY = 'nannymud:sprites';
const shouldUseSprites = (): boolean => {
  try {
    return localStorage.getItem(SPRITE_FLAG_KEY) === '1';
  } catch {
    return false;
  }
};

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

  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const toggleFullscreenRef = useRef(toggleFullscreen);
  const isFullscreenRef = useRef(isFullscreen);
  useEffect(() => { toggleFullscreenRef.current = toggleFullscreen; }, [toggleFullscreen]);
  useEffect(() => { isFullscreenRef.current = isFullscreen; }, [isFullscreen]);

  useEffect(() => { onQuitRef.current = onQuit; }, [onQuit]);
  useEffect(() => { onVictoryRef.current = onVictory; }, [onVictory]);
  useEffect(() => { onDefeatRef.current = onDefeat; }, [onDefeat]);

  useEffect(() => {
    const onExit = () => {
      stateRef.current = forcePause(stateRef.current);
    };
    window.addEventListener(FULLSCREEN_EXIT_EVENT, onExit);
    return () => window.removeEventListener(FULLSCREEN_EXIT_EVENT, onExit);
  }, []);

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
    resetController(stateRef.current, 'player');
    bossWasMusicStarted.current = false;

    audio.startStageMusic();

    let cancelled = false;
    if (shouldUseSprites()) {
      loadGuildSpriteSet(guildId).then((set) => {
        if (cancelled || !set) return;
        rendererRef.current.setActorRenderer(new SpriteActorRenderer(set));
      });
    }

    const gameLoop = (timestamp: number) => {
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dtMs = Math.min(50, timestamp - (lastTimeRef.current || timestamp));
      lastTimeRef.current = timestamp;

      const inputState = input.getInputState(stateRef.current.timeMs + dtMs);

      if (inputState.fullscreenToggleJustPressed) {
        toggleFullscreenRef.current();
      }

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

      ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);

      rendererRef.current.render(
        ctx,
        state,
        comboBufferRef.current,
        VIRTUAL_WIDTH,
        VIRTUAL_HEIGHT,
        dtMs,
        isFullscreenRef.current,
      );

      ctx.setTransform(1, 0, 0, 1, 0, 0);

      if (state.phase === 'playing' || state.phase === 'paused') {
        animFrameRef.current = requestAnimationFrame(gameLoop);
      }
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      input.dispose();
      audio.dispose();
      resetController(stateRef.current, 'player');
    };
  }, [guildId]);

  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const bufferX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const bufferY = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const virtualX = bufferX / RENDER_SCALE;
    const virtualY = bufferY / RENDER_SCALE;

    const hit = hitTestHudButton(virtualX, virtualY);
    if (!hit) return;
    if (hit === 'pause') {
      stateRef.current = forcePause(stateRef.current);
    } else if (hit === 'fullscreen') {
      toggleFullscreen();
    } else if (hit === 'quit') {
      onQuit();
    }
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      justifyContent: 'stretch',
      background: '#000',
    }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_BUFFER_WIDTH}
        height={CANVAS_BUFFER_HEIGHT}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          imageRendering: 'pixelated',
        }}
        tabIndex={0}
        onClick={handleCanvasClick}
      />
    </div>
  );
}
