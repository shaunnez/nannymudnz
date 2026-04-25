import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { BootScene } from '../../game/scenes/BootScene';

class GameplayShim extends Phaser.Scene {
  constructor() { super({ key: 'Gameplay' }); }
}

export function usePreloader(): { progress: number; done: boolean } {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;';
    document.body.appendChild(div);
    containerRef.current = div;

    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: div,
      width: 1,
      height: 1,
      backgroundColor: '#000000',
      scene: [BootScene, GameplayShim],
      audio: { noAudio: true },
      render: { antialias: false },
      input: { keyboard: false, mouse: false, touch: false },
    });

    const onProgress = (v: number) => setProgress(v);
    const onDone = () => setDone(true);

    game.events.on('preload-progress', onProgress);
    game.events.on('preload-done', onDone);

    return () => {
      game.events.off('preload-progress', onProgress);
      game.events.off('preload-done', onDone);
      game.destroy(true);
      div.remove();
      containerRef.current = null;
    };
  }, []);

  return { progress, done };
}
