import { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import type { Room } from '@colyseus/sdk';
import type { GuildId, SimMode, SimState, MatchStats, BattleSlot, BattStatEntry } from '@nannymud/shared/simulation/types';
import type { MatchState } from '@nannymud/shared';
import { PauseOverlay } from './PauseOverlay';
import { theme } from '../ui';
import { StoryGameOverOverlay } from './StoryGameOverOverlay';
import { StoryVictoryOverlay } from './StoryVictoryOverlay';
import { GuildDetails } from './GuildDetails';
import { LoadingScreen } from './LoadingScreen';
import { BattleLoadingScreen } from './BattleLoadingScreen';
import { useFullscreen } from '../layout/useFullscreen';
import { makePhaserGame, type GameCallbacks } from '../game/PhaserGame';
import { HudOverlay } from './hud/HudOverlay';
import { BattleHUD8 } from './BattleHUD8';
import { STAGES } from '../data/stages';
import type { StageId } from '../data/stages';
import { unlockStage } from '../state/useStageProgress';

interface Props {
  mode: SimMode;
  p1: GuildId;
  p2?: GuildId;
  stageId: string;
  animateHud: boolean;
  difficulty?: number;
  /** When present, GameScreen runs in multiplayer mode and mirrors server state. */
  matchRoom?: Room<MatchState>;
  /** When present, initialises the sim as battle mode. */
  battleMode?: boolean;
  battleSlots?: BattleSlot[];
  onVictory: (score: number, matchStats: MatchStats, battStats?: Record<string, BattStatEntry> | null) => void;
  onDefeat: (matchStats: MatchStats, battStats?: Record<string, BattStatEntry> | null) => void;
  /** Called when battle match ends. playerWon is true when all enemies KO or player had highest HP. */
  onBattleEnd?: (playerWon: boolean, battStats?: Record<string, BattStatEntry> | null) => void;
  /** Pass true when mode is 'surv'. Routes sim defeat to onSurvivalEnd instead of story game-over overlay. */
  survivalMode?: boolean;
  /** Called on survival defeat with final score and wave reached. */
  onSurvivalEnd?: (score: number, wave: number) => void;
  /** When provided, championship fight outcomes route here instead of onVictory/onDefeat. */
  onChampEnd?: (playerWon: boolean) => void;
  onQuit: () => void;
}

export function GameScreen({
  mode, p1, p2, stageId, animateHud, difficulty, matchRoom,
  battleMode, battleSlots,
  survivalMode,
  onVictory, onDefeat, onBattleEnd, onSurvivalEnd, onChampEnd, onQuit,
}: Props) {
  const netMode = matchRoom ? 'mp' : 'sp';
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [gameReady, setGameReady] = useState(false);
  const [preloading, setPreloading] = useState(true);
  const [loadProgress, setLoadProgress] = useState<number | undefined>(undefined);
  const [isPaused, setIsPaused] = useState(false);
  const [showMoves, setShowMoves] = useState(false);
  const [showMpQuit, setShowMpQuit] = useState(false);
  const [showStoryGameOver, setShowStoryGameOver] = useState(false);
  const [storyVictoryScore, setStoryVictoryScore] = useState<number | null>(null);
  const pausedByMovesRef = useRef(false);

  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const isFullscreenRef = useRef(isFullscreen);
  const toggleFullscreenRef = useRef(toggleFullscreen);
  useEffect(() => { isFullscreenRef.current = isFullscreen; }, [isFullscreen]);
  useEffect(() => { toggleFullscreenRef.current = toggleFullscreen; }, [toggleFullscreen]);

  const onVictoryRef = useRef(onVictory);
  const onDefeatRef = useRef(onDefeat);
  const onQuitRef = useRef(onQuit);
  const onBattleEndRef = useRef(onBattleEnd);
  const onSurvivalEndRef = useRef(onSurvivalEnd);
  const onChampEndRef = useRef(onChampEnd);
  useEffect(() => { onVictoryRef.current = onVictory; }, [onVictory]);
  useEffect(() => { onDefeatRef.current = onDefeat; }, [onDefeat]);
  useEffect(() => { onQuitRef.current = onQuit; }, [onQuit]);
  useEffect(() => { onBattleEndRef.current = onBattleEnd; }, [onBattleEnd]);
  useEffect(() => { onSurvivalEndRef.current = onSurvivalEnd; }, [onSurvivalEnd]);
  useEffect(() => { onChampEndRef.current = onChampEnd; }, [onChampEnd]);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const callbacks: GameCallbacks = {
      onVictory: (score, matchStats, battStats) => {
        if (battleMode) {
          onBattleEndRef.current?.(true, battStats);
        } else if (onChampEndRef.current) {
          onChampEndRef.current(true);
        } else if (mode === 'story') {
          const stageList = STAGES.map(s => s.id);
          const currentIdx = stageList.indexOf(stageId as StageId);
          if (currentIdx >= 0 && currentIdx < stageList.length - 1) {
            unlockStage(stageList[currentIdx + 1]);
          }
          setStoryVictoryScore(score);
        } else {
          onVictoryRef.current(score, matchStats, battStats);
        }
      },
      onDefeat: (matchStats, battStats) => {
        if (survivalMode) {
          const sim = gameRef.current?.registry.get('simState') as SimState | undefined;
          onSurvivalEndRef.current?.(sim?.survivalScore ?? 0, sim?.currentWave ?? 0);
          return;
        }
        if (battleMode) {
          onBattleEndRef.current?.(false, battStats);
        } else if (onChampEndRef.current) {
          onChampEndRef.current(false);
        } else if (mode === 'story') {
          setShowStoryGameOver(true);
        } else {
          onDefeatRef.current(matchStats, battStats);
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
      battleMode,
      battleSlots,
      survivalMode,
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

  const handleStoryVictoryRematch = useCallback(() => {
    setStoryVictoryScore(null);
    emitToGameplay('restart-requested');
  }, [emitToGameplay]);

  const handleStoryVictoryMenu = useCallback(() => {
    setStoryVictoryScore(null);
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

  useEffect(() => {
    if (netMode !== 'mp') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        e.preventDefault();
        setShowMpQuit((s) => !s);
      }
    };
    const onTouchPause = () => setShowMpQuit((s) => !s);
    window.addEventListener('keydown', onKey);
    window.addEventListener('nannymud:touch-pause', onTouchPause);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('nannymud:touch-pause', onTouchPause);
    };
  }, [netMode]);

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
      {gameReady && !battleMode && (
        <HudOverlay
          game={gameRef.current}
          stageName={stageName}
          animate={animateHud}
          inMp={netMode === 'mp'}
          localSessionId={matchRoom?.sessionId}
          hostSessionId={matchRoom?.state.hostSessionId}
        />
      )}
      {gameReady && battleMode && battleSlots && (
        <BattleHUD8
          game={gameRef.current}
          slots={battleSlots}
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
      {netMode === 'mp' && showMpQuit && (
        <MpQuitOverlay onStay={() => setShowMpQuit(false)} onQuit={onQuit} />
      )}
      {showStoryGameOver && mode === 'story' && (
        <StoryGameOverOverlay
          onRematch={handleStoryRematch}
          onMenu={handleStoryMenu}
        />
      )}
      {storyVictoryScore !== null && mode === 'story' && (
        <StoryVictoryOverlay
          score={storyVictoryScore}
          onRematch={handleStoryVictoryRematch}
          onMenu={handleStoryVictoryMenu}
        />
      )}
      {preloading && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {battleMode && battleSlots ? (
            <BattleLoadingScreen
              slots={battleSlots}
              stageId={stageId as StageId}
              humanProgress={loadProgress ?? 0}
            />
          ) : (
            <LoadingScreen
              p1={p1}
              p2={p2 ?? 'knight'}
              stageId={stageId as StageId}
              showOpponent={mode === 'vs'}
              progress={loadProgress}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MpQuitOverlay({ onStay, onQuit }: { onStay: () => void; onQuit: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); onStay(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStay]);

  return (
    <div
      onClick={onStay}
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          background: theme.panel,
          border: `1px solid ${theme.line}`,
          padding: 36,
          fontFamily: theme.fontBody,
        }}
      >
        <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 4, marginBottom: 4 }}>
          MULTIPLAYER
        </div>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 38, color: theme.ink, letterSpacing: '-0.02em', marginBottom: 28 }}>
          Quit match?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            onClick={onStay}
            style={{ cursor: 'pointer', padding: '14px 0', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: 19, color: theme.accent }}>STAY IN MATCH</div>
              <div style={{ fontFamily: theme.fontBody, fontSize: 11, color: theme.inkMuted, marginTop: 2 }}>return to the fight</div>
            </div>
            <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.accent }}>→</span>
          </div>
          <div
            onClick={onQuit}
            style={{ cursor: 'pointer', padding: '14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: 19, color: theme.bad }}>QUIT TO MENU</div>
              <div style={{ fontFamily: theme.fontBody, fontSize: 11, color: theme.inkMuted, marginTop: 2 }}>forfeit and disconnect</div>
            </div>
            <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.bad }}>→</span>
          </div>
        </div>
      </div>
    </div>
  );
}
