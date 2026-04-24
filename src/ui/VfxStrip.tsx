import { useEffect, useRef, useState } from 'react';

interface VfxAssetMeta {
  frames: number;
  frameDurationMs: number;
  loop: boolean;
  frameSize?: { w: number; h: number };
}

interface VfxMeta {
  frameSize: { w: number; h: number };
  assets: Record<string, VfxAssetMeta>;
}

interface Props {
  guildId: string;
  assetKey: string;
  scale?: number;
  pauseMs?: number;
}

const metaCache = new Map<string, Promise<VfxMeta | null>>();

function loadMeta(guildId: string): Promise<VfxMeta | null> {
  let cached = metaCache.get(guildId);
  if (cached) return cached;
  cached = fetch(`/vfx/${guildId}/metadata.json`).then(
    (r) => (r.ok ? r.json() : null),
    () => null,
  );
  metaCache.set(guildId, cached);
  return cached;
}

export function VfxStrip({ guildId, assetKey, scale = 2, pauseMs = 400 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [meta, setMeta] = useState<VfxMeta | null>(null);
  const [missing, setMissing] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMeta(guildId).then((m) => {
      if (cancelled) return;
      if (!m || !m.assets[assetKey]) {
        setMissing(true);
        setMeta(null);
        return;
      }
      setMissing(false);
      setMeta(m);
      const img = new Image();
      img.src = `/vfx/${guildId}/${assetKey}.png`;
      img.onload = () => {
        if (!cancelled) imgRef.current = img;
      };
    });
    return () => {
      cancelled = true;
      imgRef.current = null;
    };
  }, [guildId, assetKey]);

  useEffect(() => {
    if (!meta) return;
    const spec = meta.assets[assetKey];
    const canvas = canvasRef.current;
    if (!canvas || !spec) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const frameSize = spec.frameSize ?? meta.frameSize;
    const { w, h } = frameSize;

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
  }, [meta, assetKey, scale, pauseMs]);

  if (missing) return null;

  const frameSize = meta?.assets[assetKey]?.frameSize ?? meta?.frameSize ?? { w: 96, h: 96 };
  return (
    <canvas
      ref={canvasRef}
      width={frameSize.w * scale}
      height={frameSize.h * scale}
      style={{ imageRendering: 'pixelated', display: 'block' }}
    />
  );
}
