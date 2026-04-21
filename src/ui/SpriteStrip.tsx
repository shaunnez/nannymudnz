import { useEffect, useRef, useState } from 'react';

interface StripMeta {
  frameSize: { w: number; h: number };
  animations: Record<string, { frames: number; frameDurationMs: number; loop: boolean }>;
}

interface Props {
  guildId: string;
  animationId: string;
  scale?: number;
  pauseMs?: number;
}

const metaCache = new Map<string, Promise<StripMeta | null>>();

function loadMeta(guildId: string): Promise<StripMeta | null> {
  let cached = metaCache.get(guildId);
  if (cached) return cached;
  cached = fetch(`/sprites/${guildId}/metadata.json`).then(
    (r) => (r.ok ? r.json() : null),
    () => null,
  );
  metaCache.set(guildId, cached);
  return cached;
}

export function SpriteStrip({ guildId, animationId, scale = 3, pauseMs = 400 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [meta, setMeta] = useState<StripMeta | null>(null);
  const [missing, setMissing] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMeta(guildId).then((m) => {
      if (cancelled) return;
      if (!m || !m.animations[animationId]) {
        setMissing(true);
        setMeta(null);
        return;
      }
      setMissing(false);
      setMeta(m);
      const img = new Image();
      img.src = `/sprites/${guildId}/${animationId}.png`;
      img.onload = () => {
        if (!cancelled) imgRef.current = img;
      };
    });
    return () => {
      cancelled = true;
      imgRef.current = null;
    };
  }, [guildId, animationId]);

  useEffect(() => {
    if (!meta) return;
    const spec = meta.animations[animationId];
    const canvas = canvasRef.current;
    if (!canvas || !spec) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const { w, h } = meta.frameSize;

    const startMs = performance.now();
    let raf = 0;
    const cycleMs = spec.frames * spec.frameDurationMs + (spec.loop ? 0 : pauseMs);

    const tick = (now: number) => {
      const elapsed = (now - startMs) % cycleMs;
      const raw = Math.floor(elapsed / spec.frameDurationMs);
      const frame = spec.loop ? raw % spec.frames : Math.min(raw, spec.frames - 1);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const img = imgRef.current;
      if (img) ctx.drawImage(img, frame * w, 0, w, h, 0, 0, w * scale, h * scale);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [meta, animationId, scale, pauseMs]);

  if (missing) {
    return (
      <div
        style={{
          width: 68 * scale,
          height: 68 * scale,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          fontSize: 10,
          color: '#666',
          border: '1px dashed #333',
        }}
      >
        no sprites
      </div>
    );
  }

  const w = meta?.frameSize.w ?? 68;
  const h = meta?.frameSize.h ?? 68;
  return (
    <canvas
      ref={canvasRef}
      width={w * scale}
      height={h * scale}
      style={{ imageRendering: 'pixelated', display: 'block' }}
    />
  );
}
