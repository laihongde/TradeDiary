import { useEffect, useRef } from "react";

interface SplashScreenProps {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 粒子動畫 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      color: string;
    }[] = [];

    const colors = ["#60a5fa", "#818cf8", "#a78bfa", "#34d399", "#38bdf8"];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        size: Math.random() * 3 + 1,
        alpha: Math.random() * 0.6 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });

      // 連線
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.save();
            ctx.globalAlpha = ((100 - dist) / 100) * 0.15;
            ctx.strokeStyle = "#818cf8";
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => cancelAnimationFrame(animId);
  }, []);

  // 2.5 秒後淡出
  useEffect(() => {
    const timer = setTimeout(onFinish, 2800);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="splash-root">
      <canvas ref={canvasRef} className="splash-canvas" />

      {/* 背景光暈 */}
      <div className="splash-orb splash-orb-1" />
      <div className="splash-orb splash-orb-2" />
      <div className="splash-orb splash-orb-3" />

      <div className="splash-content">
        {/* 股票圖示 */}
        <div className="splash-icon-wrap">
          <svg
            className="splash-icon"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polyline
              className="splash-chart-line"
              points="4,48 16,36 24,42 36,20 44,28 60,8"
              stroke="url(#splashGrad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <defs>
              <linearGradient id="splashGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
          </svg>
          <div className="splash-icon-glow" />
        </div>

        {/* 標題 */}
        <h1 className="splash-title">
          {"股惑仔".split("").map((ch, i) => (
            <span
              key={i}
              className="splash-letter"
              style={{ animationDelay: `${0.4 + i * 0.08}s` }}
            >
              {ch}
            </span>
          ))}
        </h1>

        <p className="splash-subtitle">Stock Analysis Tracker</p>

        {/* 載入條 */}
        <div className="splash-bar-wrap">
          <div className="splash-bar" />
        </div>

        {/* 跑動數字 */}
        <div className="splash-ticker">
          {["+2.34%", "▲ 0.87%", "▼ 1.20%", "+5.60%", "▲ 3.14%"].map(
            (v, i) => (
              <span
                key={i}
                className="splash-tick-item"
                style={{ animationDelay: `${i * 0.18}s` }}
              >
                {v}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}
