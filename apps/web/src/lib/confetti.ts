import { BAND_COLORS } from "./cards.ts";
import { motion } from "./motion.ts";

const COLORS = [...Object.values(BAND_COLORS).map((c) => c.fill), "#ffe27a", "#f3fbf8"];
const DURATION = 3400;
/** Downward pull per frame at 60 frames a second, in CSS pixels. */
const GRAVITY = 0.32;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  angle: number;
  spin: number;
  tilt: number;
  color: string;
}

const between = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Fires confetti from both bottom corners of the screen for the end of a game. Draws on a
 * throwaway canvas above everything, so it needs no layout and never blocks a tap. Skipped when
 * the device asks for reduced motion.
 */
export function confetti(): void {
  if (motion(1) === 0) return;
  const width = innerWidth;
  const height = innerHeight;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "confetti";
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    zIndex: "70",
    pointerEvents: "none",
  });
  document.body.append(canvas);
  ctx.scale(ratio, ratio);

  const count = Math.round(Math.min(180, Math.max(80, width / 5)));
  const pieces: Piece[] = Array.from({ length: count }, (_, i) => {
    const left = i % 2 === 0;
    // Aim up and inwards, strong enough to reach most of the way up the screen.
    const aim = between(0.3, 0.5) * Math.PI;
    const speed = Math.sqrt(2 * GRAVITY * height * between(0.5, 1)) * 1.15;
    return {
      x: left ? 0 : width,
      y: height,
      vx: Math.cos(aim) * speed * (left ? 1 : -1) * between(0.5, 1.2),
      vy: -Math.sin(aim) * speed,
      w: between(6, 11),
      h: between(3, 6),
      angle: between(0, Math.PI * 2),
      spin: between(-0.25, 0.25),
      tilt: between(0, Math.PI * 2),
      color: COLORS[i % COLORS.length] ?? "#ffe27a",
    };
  });

  const start = performance.now();
  let last = start;
  const frame = (now: number) => {
    const elapsed = now - start;
    if (elapsed >= DURATION) {
      canvas.remove();
      return;
    }
    const step = Math.min(3, (now - last) / (1000 / 60));
    last = now;
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = Math.min(1, (DURATION - elapsed) / 800);
    for (const p of pieces) {
      p.vx *= 0.985 ** step;
      p.vy = Math.min(p.vy * 0.985 ** step + GRAVITY * step, 4.5);
      p.x += (p.vx + Math.sin(p.tilt) * 0.8) * step;
      p.y += p.vy * step;
      p.angle += p.spin * step;
      p.tilt += 0.08 * step;
      if (p.y > height + 20) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      // Turning over: the paper narrows to an edge and widens again.
      ctx.scale(1, Math.cos(p.tilt * 1.7));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
