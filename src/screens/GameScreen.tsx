import { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import type { Room } from '@colyseus/sdk';
import type { GuildId, SimMode, SimState } from '@nannymud/shared/simulation/types';
import type { MatchState } from '@nannymud/shared';
import { PauseOverlay } from './PauseOverlay';
import { StoryGameOverOverlay } from './StoryGameOverOverlay';
import { GuildDetails } from './GuildDetails';
import { LoadingScreen } from './LoadingScreen';
import { useFullscreen } from '../layout/useFullscreen';
import { makePhaserGame, type GameCallbacks } from '../game/PhaserGame';
import { HudOverlay } from './hud/HudOverlay';
import { STAGES } from '../data/stages';
import type { StageId } from '../data/stages';

interface Props {
  mode: SimMode;
  p1: GuildId;
  p2?: GuildId;
  stageId: string;
  animateHud: boolean;
  difficulty?: number;
  /** When present, GameScreen runs in multiplayer mode and mirrors server state. */
  matchRoom?: Room<MatchState>;
  onVictory: (score: number) => void;
  onDefeat: () => void;
  onQuit: () => void;
}

export function GameScreen({
  mode, p1, p2, stageId, animateHud, difficulty, matchRoom,
  onVictory, onDefeat, onQuit,
}: Props) {
  const netMode = matchRoom ? 'mp' : 'sp';
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [gameReady, setGameReady] = useState(false);
  const [preloading, setPreloading] = useState(true);
  const [loadProgress, setLoadProgress] = useState<number | undefined>(undefined);
  const [isPaused, setIsPaused] = useState(false);
  const [showMoves, setShowMoves] = useState(false);
  const [showStoryGameOver, setShowStoryGameOver] = useState(false);
  const pausedByMovesRef = useRef(false);

  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const isFullscreenRef = useRef(isFullscreen);
  const toggleFullscreenRef = useRef(toggleFullscreen);
  useEffect(() => { isFullscreenRef.current = isFullscreen; }, [isFullscreen]);
  useEffect(() => { toggleFullscreenRef.current = toggleFullscreen; }, [toggleFullscreen]);

  const onVictoryRef = useRef(onVictory);
  const onDefeatRef = useRef(onDefeat);
  const onQuitRef = useRef(onQuit);
  useEffect(() => { onVictoryRef.current = onVictory; }, [onVictory]);
  useEffect(() => { onDefeatRef.current = onDefeat; }, [onDefeat]);
  useEffect(() => { onQuitRef.current = onQuit; }, [onQuit]);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const callbacks: GameCallbacks = {
      onVictory: (score) => onVictoryRef.current(score),
      onDefeat: () => {
        if (mode === 'story') {
          setShowStoryGameOver(true);
        } else {
          onDefeatRef.current();
        }
      },
      onQuit: () => onQuitRef.current(),
      toggleFullscreen: () => toggleFullscreenRef.current(),
      getIsFullscreen: () => isFullscreenRef.current,
    };

    const game = makePhaserGame(parent, {
      guildId: p1,
      mode,
      p2,
      stageId,
      callbacks,
      netMode,
      matchRoom,
      difficulty,
    });
    gameRef.current = game;
    setGameReady(true);

    const onPhaseChange = (phase: SimState['phase']) => {
      setIsPaused(phase === 'paused');
    };
    game.events.on('phase-change', onPhaseChange);

    const onPreloadDone = () => setPreloading(false);
    game.events.on('preload-done', onPreloadDone);
    game.events.on('preload-progress', setLoadProgress);
    // If Boot already ran by the time this listener is attached (HMR, slow
    // commit), the sticky registry flag saves us from hanging on the overlay.
    if (game.registry.get('preloadDone')) setPreloading(false);

    return () => {
      game.events.off('phase-change', onPhaseChange);
      game.events.off('preload-done', onPreloadDone);
      game.events.off('preload-progress', setLoadProgress);
      game.destroy(true);
      gameRef.current = null;
      setGameReady(false);
      setPreloading(true);
      setLoadProgress(undefined);
    };
  }, [mode, p1, p2, stageId, netMode, matchRoom, difficulty]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    game.registry.set('isFullscreen', isFullscreen);
  }, [isFullscreen]);

  const emitToGameplay = useCallback((event: string) => {
    const game = gameRef.current;
    if (!game) return;
    const scene = game.scene.getScene('Gameplay');
    if (scene) scene.events.emit(event);
  }, []);

  const handleResume = useCallback(() => {
    emitToGameplay('resume-requested');
  }, [emitToGameplay]);

  const handleRestart = useCallback(() => {
    emitToGameplay('restart-requested');
  }, [emitToGameplay]);

  const handleStoryRematch = useCallback(() => {
    setShowStoryGameOver(false);
    emitToGameplay('restart-requested');
  }, [emitToGameplay]);

  const handleStoryMenu = useCallback(() => {
    setShowStoryGameOver(false);
    onQuit();
  }, [onQuit]);

  const closeMoves = useCallback(() => {
    setShowMoves(false);
    if (pausedByMovesRef.current) {
      emitToGameplay('resume-requested');
      pausedByMovesRef.current = false;
    }
  }, [emitToGameplay]);

  useEffect(() => {
    // Tab-to-moves popup uses local pause, which the server doesn't honour in MP.
    if (netMode === 'mp') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      if (showMoves) {
        closeMoves();
        return;
      }
      const game = gameRef.current;
      if (!game) return;
      const simState = game.registry.get('simState') as SimState | undefined;
      if (!simState) return;
      if (simState.phase !== 'playing' && simState.phase !== 'paused') return;
      if (simState.phase === 'playing') {
        emitToGameplay('pause-requested');
        pausedByMovesRef.current = true;
      }
      setShowMoves(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeMoves, emitToGameplay, showMoves, netMode]);

  const stage = STAGES.find((s) => s.id === stageId);
  const stageName = stage?.name ?? 'Arena';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        background: '#000',
      }}
    >
      <div ref={parentRef} style={{ width: '100%', height: '100%' }} />
      {gameReady && (
        <HudOverlay
          game={gameRef.current}
          stageName={stageName}
          animate={animateHud}
          inMp={netMode === 'mp'}
          localSessionId={matchRoom?.sessionId}
          hostSessionId={matchRoom?.state.hostSessionId}
        />
      )}
      {netMode !== 'mp' && isPaused && !showMoves && (
        <PauseOverlay
          onResume={handleResume}
          onRestart={handleRestart}
          onQuit={onQuit}
          onMoveList={() => setShowMoves(true)}
        />
      )}
      {netMode !== 'mp' && showMoves && <GuildDetails guildId={p1} onClose={closeMoves} />}
      {showStoryGameOver && mode === 'story' && (
        <StoryGameOverOverlay
          onRematch={handleStoryRematch}
          onMenu={handleStoryMenu}
        />
      )}
      {preloading && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <LoadingScreen
            p1={p1}
            p2={p2 ?? 'knight'}
            stageId={stageId as StageId}
            showOpponent={mode === 'vs'}
            progress={loadProgress}
          />
        </div>
      )}
    </div>
  );
}
