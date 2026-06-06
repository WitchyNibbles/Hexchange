import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  twinklePhase: number;
  twinkleSpeed: number;
}

const STAR_COUNT = 80;
const CONNECTION_DISTANCE = 110;
const PARALLAX_PX = 18;

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const starsRef = useRef<Star[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }

    function initStars() {
      starsRef.current = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.00005,
        vy: (Math.random() - 0.5) * 0.00005,
        radius: Math.random() * 1.2 + 0.3,
        opacity: Math.random() * 0.5 + 0.4,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.018 + 0.004,
      }));
    }

    function onMouseMove(e: MouseEvent) {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth - 0.5) * PARALLAX_PX,
        y: (e.clientY / window.innerHeight - 0.5) * PARALLAX_PX,
      };
    }

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const { x: mx, y: my } = mouseRef.current;
      const stars = starsRef.current;

      for (const star of stars) {
        star.x = (star.x + star.vx + 1) % 1;
        star.y = (star.y + star.vy + 1) % 1;
        star.twinklePhase += star.twinkleSpeed;
      }

      const sx = stars.map((s) => s.x * w + mx);
      const sy = stars.map((s) => s.y * h + my);

      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = sx[i] - sx[j];
          const dy = sy[i] - sy[j];
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DISTANCE) {
            const alpha = ((1 - dist / CONNECTION_DISTANCE) * 0.15).toFixed(3);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(76,201,240,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(sx[i], sy[i]);
            ctx.lineTo(sx[j], sy[j]);
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const twinkle = Math.sin(star.twinklePhase) * 0.25 + 0.75;
        const alpha = (star.opacity * twinkle).toFixed(3);
        ctx.beginPath();
        ctx.arc(sx[i], sy[i], star.radius, 0, Math.PI * 2);
        ctx.fillStyle =
          star.radius > 1
            ? `rgba(126,240,255,${alpha})`
            : `rgba(255,255,255,${alpha})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    resize();
    initStars();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
    />
  );
}
