import { useEffect, useRef } from "react";
import { starEvents } from "../lib/star-events";

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

const STAR_COUNT = 100;
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

    interface ShootingStar {
      x: number;
      y: number;
      dx: number;
      dy: number;
      progress: number;
      length: number;
    }
    const shootingStarsRef = { current: [] as ShootingStar[] };

    starEvents.register(() => {
      shootingStarsRef.current.push({
        x: Math.random() * 0.6 + 0.1,
        y: Math.random() * 0.4,
        dx: 0.35 + Math.random() * 0.2,
        dy: 0.18 + Math.random() * 0.15,
        progress: 0,
        length: 90 + Math.random() * 60,
      });
    });

    let isIdle = false;
    let idleTimer: ReturnType<typeof setTimeout>;

    function resetIdleTimer() {
      isIdle = false;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { isIdle = true; }, 45_000);
    }

    function onMouseMove(e: MouseEvent) {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth - 0.5) * PARALLAX_PX,
        y: (e.clientY / window.innerHeight - 0.5) * PARALLAX_PX,
      };
      resetIdleTimer();
    }

    resetIdleTimer();

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const { x: mx, y: my } = mouseRef.current;
      const stars = starsRef.current;

      const driftMult = isIdle ? 3.5 : 1;
      for (const star of stars) {
        star.x = (star.x + star.vx * driftMult + 1) % 1;
        star.y = (star.y + star.vy * driftMult + 1) % 1;
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

      // Advance and draw shooting stars
      const speed = 0.032;
      shootingStarsRef.current = shootingStarsRef.current.filter((ss) => ss.progress < 1);
      for (const ss of shootingStarsRef.current) {
        ss.progress = Math.min(1, ss.progress + speed);
        const startX = ss.x * w + ss.dx * ss.length * ss.progress * w * 0.0012 + mx;
        const startY = ss.y * h + ss.dy * ss.length * ss.progress * h * 0.0012 + my;
        const tailX = startX - ss.dx * ss.length * (1 - ss.progress + 0.1);
        const tailY = startY - ss.dy * ss.length * (1 - ss.progress + 0.1);
        const alpha = Math.sin(ss.progress * Math.PI) * 0.85;
        const grad = ctx.createLinearGradient(tailX, tailY, startX, startY);
        grad.addColorStop(0, `rgba(255,255,255,0)`);
        grad.addColorStop(1, `rgba(180,240,255,${alpha.toFixed(3)})`);
        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(startX, startY);
        ctx.stroke();
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
      starEvents.unregister();
      clearTimeout(idleTimer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
    />
  );
}
