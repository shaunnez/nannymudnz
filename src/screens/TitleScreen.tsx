import { useEffect, useRef } from 'react';

interface Props {
  onStart: () => void;
}

export function TitleScreen({ onStart }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;

      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
      sky.addColorStop(0, '#1e3a5f');
      sky.addColorStop(1, '#2d6a9f');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      const stars = [
        [80, 40], [200, 80], [350, 30], [500, 60], [650, 25], [780, 70],
        [120, 120], [400, 100], [600, 90], [720, 110], [50, 150], [300, 140],
      ];
      for (const [sx, sy] of stars) {
        const twinkle = Math.sin(frame * 0.05 + sx) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255,255,255,${0.4 + twinkle * 0.6})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#2d5a1b';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.62);
      for (let x = 0; x <= w; x += 8) {
        const hy = h * 0.62 - Math.abs(Math.sin(x / 180 * Math.PI)) * 60 - Math.abs(Math.sin(x / 90 * Math.PI)) * 25;
        ctx.lineTo(x, hy);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#3d7a28';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.68);
      for (let x = 0; x <= w; x += 6) {
        const hy = h * 0.68 - Math.abs(Math.sin(x / 120 * Math.PI + 1)) * 35 - Math.abs(Math.sin(x / 60 * Math.PI + 2)) * 15;
        ctx.lineTo(x, hy);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#5a8a3c';
      ctx.fillRect(0, h * 0.76, w, h * 0.24);

      const titleGrad = ctx.createLinearGradient(0, h * 0.18, 0, h * 0.42);
      titleGrad.addColorStop(0, '#ffd700');
      titleGrad.addColorStop(0.5, '#ff8c00');
      titleGrad.addColorStop(1, '#c9a961');

      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 15;
      ctx.font = `bold ${w < 700 ? 56 : 72}px Georgia, serif`;
      ctx.fillStyle = titleGrad;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NANNYMUD', w / 2, h * 0.3);

      ctx.shadowBlur = 5;
      ctx.font = `italic ${w < 700 ? 18 : 24}px Georgia, serif`;
      ctx.fillStyle = '#e0d0b0';
      ctx.fillText('A Guild Wars Beat-\'Em-Up', w / 2, h * 0.44);
      ctx.shadowBlur = 0;

      const fighters = [
        { x: w * 0.18, color: '#a8dadc', initial: 'K' },
        { x: w * 0.32, color: '#4caf50', initial: 'D' },
        { x: w * 0.5, color: '#c9a961', initial: 'A' },
        { x: w * 0.68, color: '#8e6dc8', initial: 'M' },
        { x: w * 0.82, color: '#b74c2a', initial: 'V' },
      ];

      fighters.forEach(({ x, color, initial }) => {
        const bounce = Math.sin(frame * 0.04 + x) * 4;
        const gy = h * 0.76;

        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(x, gy - 2, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = color;
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x - 16, gy - 52 + bounce, 32, 48, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(initial, x, gy - 28 + bounce);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + 16, gy - 38 + bounce);
        ctx.lineTo(x + 24, gy - 34 + bounce);
        ctx.lineTo(x + 16, gy - 30 + bounce);
        ctx.closePath();
        ctx.fill();
      });

      const btnY = h * 0.88;
      const btnW = 200;
      const btnH = 50;
      const pulse = Math.sin(frame * 0.06) * 0.15 + 0.85;
      ctx.globalAlpha = pulse;
      const btnGrad = ctx.createLinearGradient(w / 2 - btnW / 2, btnY - btnH / 2, w / 2 - btnW / 2, btnY + btnH / 2);
      btnGrad.addColorStop(0, '#d97706');
      btnGrad.addColorStop(1, '#92400e');
      ctx.fillStyle = btnGrad;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(w / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#fff7ed';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▶  START GAME', w / 2, btnY);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.fillText('15 guilds · 6 waves · 1 boss · Browser-native', w / 2, h * 0.96);

      frame++;
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', cursor: 'pointer' }}
      onClick={onStart}
    >
      <canvas
        ref={canvasRef}
        width={900}
        height={500}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
    </div>
  );
}
