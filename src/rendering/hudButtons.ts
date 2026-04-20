import { VIRTUAL_WIDTH } from './constants';

export interface HudButtonRect {
  id: 'pause' | 'fullscreen' | 'quit';
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

// Layout is in VIRTUAL coords (the renderer's coordinate space). Top-right cluster.
const BUTTON_W = 72;
const BUTTON_H = 22;
const GAP = 6;
const RIGHT_MARGIN = 10;
const TOP_MARGIN = 74; // below the wave-info box at the top-right

export function getHudButtonRects(): HudButtonRect[] {
  // Right-to-left: quit | fullscreen | pause
  const ids: Array<HudButtonRect['id']> = ['pause', 'fullscreen', 'quit'];
  const labels: Record<HudButtonRect['id'], string> = {
    pause: 'Pause (P)',
    fullscreen: 'Fullscreen (F)',
    quit: 'Quit',
  };
  const rects: HudButtonRect[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const x = VIRTUAL_WIDTH - RIGHT_MARGIN - (ids.length - i) * BUTTON_W - (ids.length - 1 - i) * GAP;
    rects.push({ id, x, y: TOP_MARGIN, w: BUTTON_W, h: BUTTON_H, label: labels[id] });
  }
  return rects;
}

export function renderHudButtons(
  ctx: CanvasRenderingContext2D,
  isPaused: boolean,
  isFullscreen: boolean,
): void {
  const rects = getHudButtonRects();
  ctx.save();
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const r of rects) {
    const active = (r.id === 'pause' && isPaused) || (r.id === 'fullscreen' && isFullscreen);
    ctx.fillStyle = active ? 'rgba(251,191,36,0.25)' : 'rgba(0,0,0,0.5)';
    ctx.strokeStyle = active ? '#fbbf24' : '#374151';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e5e7eb';
    ctx.fillText(r.label, r.x + r.w / 2, r.y + r.h / 2);
  }
  ctx.restore();
}

// Hit-test a click in VIRTUAL coords against the button layout.
// Returns the id of the clicked button, or null.
export function hitTestHudButton(virtualX: number, virtualY: number): HudButtonRect['id'] | null {
  for (const r of getHudButtonRects()) {
    if (virtualX >= r.x && virtualX <= r.x + r.w && virtualY >= r.y && virtualY <= r.y + r.h) {
      return r.id;
    }
  }
  return null;
}
