import { useEffect, useRef } from 'react';

interface Props {
  outcome: 'victory' | 'defeat';
  score: number;
  onRetry: () => void;
  onMenu: () => void;
}

export function GameOverScreen({ outcome, score, onRetry, onMenu }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const isVictory = outcome === 'victory';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = isVictory
        ? `rgba(10, 20, 10, ${Math.min(1, frame * 0.04)})`
        : `rgba(10, 5, 5, ${Math.min(1, frame * 0.04)})`;
      ctx.fillRect(0, 0, w, h);

      if (frame < 25) {
        animRef.current = requestAnimationFrame(draw);
        frame++;
        return;
      }

      if (isVictory) {
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + frame * 0.01;
          const r = 160 + Math.sin(frame * 0.05 + i) * 20;
          const px = w / 2 + Math.cos(angle) * r;
          const py = h / 2 + Math.sin(angle) * r * 0.4;
          const alpha = (Math.sin(frame * 0.08 + i) + 1) * 0.3;
          ctx.fillStyle = `rgba(255,215,0,${alpha})`;
          ctx.beginPath();
          ctx.arc(px, py, 4 + Math.sin(frame * 0.1 + i) * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        for (let x = 0; x < w; x += 30) {
          for (let y = 0; y < h; y += 30) {
            const alpha = Math.sin(frame * 0.03 + x * 0.01 + y * 0.01) * 0.05 + 0.05;
            if (alpha > 0) {
              ctx.fillStyle = `rgba(139,0,0,${alpha})`;
              ctx.fillRect(x, y, 28, 28);
            }
          }
        }
      }

      const titleScale = Math.min(1, (frame - 25) * 0.05);
      ctx.save();
      ctx.translate(w / 2, h * 0.3);
      ctx.scale(titleScale, titleScale);

      const titleText = isVictory ? 'VICTORY!' : 'DEFEATED';
      const titleColor = isVictory
        ? `hsl(${50 + Math.sin(frame * 0.05) * 10}, 90%, 60%)`
        : `hsl(${5 + Math.sin(frame * 0.05) * 5}, 80%, 55%)`;

      ctx.shadowColor = isVictory ? '#ffd700' : '#8b0000';
      ctx.shadowBlur = 30;
      ctx.font = 'bold 68px Georgia, serif';
      ctx.fillStyle = titleColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(titleText, 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();

      if (frame > 40) {
        const scoreAlpha = Math.min(1, (frame - 40) * 0.05);
        ctx.globalAlpha = scoreAlpha;

        if (isVictory) {
          ctx.fillStyle = '#fde68a';
          ctx.font = 'bold 24px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('The Bandit King has fallen!', w / 2, h * 0.48);
        } else {
          ctx.fillStyle = '#fca5a5';
          ctx.font = 'bold 20px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('The Plains claim another hero...', w / 2, h * 0.48);
        }

        ctx.fillStyle = '#9ca3af';
        ctx.font = '16px sans-serif';
        ctx.fillText(`Final Score: ${score.toLocaleString()}`, w / 2, h * 0.57);

        ctx.globalAlpha = 1;
      }

      if (frame > 55) {
        const btnAlpha = Math.min(1, (frame - 55) * 0.06);
        ctx.globalAlpha = btnAlpha;

        const retryColor = isVictory ? '#d97706' : '#dc2626';
        const retryGrad = ctx.createLinearGradient(w / 2 - 100, h * 0.68, w / 2 - 100, h * 0.68 + 44);
        retryGrad.addColorStop(0, retryColor);
        retryGrad.addColorStop(1, retryColor + '99');
        ctx.fillStyle = retryGrad;
        ctx.strokeStyle = isVictory ? '#fbbf24' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(w / 2 - 100, h * 0.68, 200, 44, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('▶  RETRY', w / 2, h * 0.68 + 22);

        ctx.fillStyle = 'rgba(30,41,59,0.8)';
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(w / 2 - 100, h * 0.78, 200, 38, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#9ca3af';
        ctx.font = '15px sans-serif';
        ctx.fillText('← Back to Menu', w / 2, h * 0.78 + 19);

        ctx.globalAlpha = 1;
      }

      frame++;
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [isVictory]);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
    }}>
      <canvas
        ref={canvasRef}
        width={900}
        height={500}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
      <div style={{
        position: 'absolute',
        bottom: '18%',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: 200,
      }}>
        <button
          onClick={onRetry}
          style={{
            background: 'transparent',
            border: 'none',
            height: 44,
            cursor: 'pointer',
          }}
        />
        <button
          onClick={onMenu}
          style={{
            background: 'transparent',
            border: 'none',
            height: 38,
            cursor: 'pointer',
          }}
        />
      </div>
    </div>
  );
}
