import type { VizPalette } from "@/lib/audio/themes";
import type { VizMode } from "@/lib/settings";

export type Smoother = {
  values: Float32Array;
  energy: number;
};

export function createSmoother(): Smoother {
  return { values: new Float32Array(96), energy: 0 };
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function withAlpha(hex: string, alpha: number) {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function logBands(freq: Uint8Array, count: number, out: Float32Array) {
  const n = freq.length;
  const start = 2;
  const end = Math.max(start + count, Math.floor(n * 0.9));
  for (let i = 0; i < count; i++) {
    const t0 = i / count;
    const t1 = (i + 1) / count;
    const a = Math.min(n - 1, Math.floor(start * (end / start) ** t0));
    const b = Math.min(n, Math.max(a + 1, Math.floor(start * (end / start) ** t1)));
    let sum = 0;
    for (let k = a; k < b; k++) sum += freq[k];
    out[i] = sum / ((b - a) * 255);
  }
}

function smoothInto(smoother: Smoother, target: Float32Array, count: number, sensitivity: number) {
  const rise = 0.34 + sensitivity * 0.28;
  const fall = 0.045 + (1 - sensitivity) * 0.04;
  let energy = 0;
  for (let i = 0; i < count; i++) {
    const shaped = Math.min(1.15, target[i] ** (1.15 - sensitivity * 0.45));
    const prev = smoother.values[i] ?? 0;
    const k = shaped > prev ? rise : fall;
    const next = prev + (shaped - prev) * k;
    smoother.values[i] = next;
    energy += next;
  }
  const avg = energy / count;
  smoother.energy += (avg - smoother.energy) * 0.18;
}

function idleValue(index: number, count: number, now: number, reduced: boolean) {
  if (reduced) return 0.08 + (index % 5) * 0.015;
  const travel = now / 900 + index * 0.34;
  return 0.18 + 0.42 * (0.5 + 0.5 * Math.sin(travel)) ** 1.2 * (0.55 + 0.45 * Math.sin((index / count) * Math.PI));
}

export function fitCanvas(canvas: HTMLCanvasElement) {
  const parent = canvas.parentElement;
  if (!parent) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = parent.clientWidth;
  const h = parent.clientHeight;
  if (w < 2 || h < 2) return;
  const bw = Math.floor(w * dpr);
  const bh = Math.floor(h * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
}

export function drawFrame(
  canvas: HTMLCanvasElement,
  freq: Uint8Array | null,
  time: Uint8Array | null,
  smoother: Smoother,
  opts: {
    mode: VizMode;
    palette: VizPalette;
    sensitivity: number;
    now: number;
    reduced: boolean;
  },
) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  if (w < 2 || h < 2) return;
  const px = canvas.clientWidth > 0 ? w / canvas.clientWidth : 1;
  const { mode, palette, sensitivity, now, reduced } = opts;

  const cssW = canvas.clientWidth || 800;
  const count = mode === "bars" ? Math.max(28, Math.min(80, Math.floor(cssW / 14))) : mode === "radial" ? 72 : 6;
  const target = new Float32Array(count);
  if (freq) logBands(freq, count, target);
  smoothInto(smoother, target, count, sensitivity);

  const gate = clamp01((smoother.energy - 0.02) / 0.07);
  const levels = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const idle = idleValue(i, count, now, reduced);
    levels[i] = (smoother.values[i] ?? 0) * gate + idle * (1 - gate);
  }

  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, h * (mode === "bars" ? 0.78 : 0.5), 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.62);
  glow.addColorStop(0, withAlpha(palette.mid, 0.08 + smoother.energy * 0.38));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  if (mode === "bars") drawBars(ctx, w, h, px, levels, palette);
  else if (mode === "radial") drawRadial(ctx, w, h, px, levels, time, palette, now, smoother.energy, reduced);
  else drawRings(ctx, w, h, px, levels, time, palette, now, reduced);

  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.72);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function drawBars(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  px: number,
  levels: Float32Array,
  palette: VizPalette,
) {
  const count = levels.length;
  const slot = w / count;
  const gap = Math.max(px, slot * 0.3);
  const barW = Math.max(px, slot - gap);
  const baseline = h * 0.7;
  const maxH = h * 0.52;
  const grad = ctx.createLinearGradient(0, baseline, 0, baseline - maxH);
  grad.addColorStop(0, palette.low);
  grad.addColorStop(0.55, palette.mid);
  grad.addColorStop(1, palette.high);

  ctx.fillStyle = withAlpha(palette.mid, 0.22);
  for (let i = 0; i < count; i++) {
    const bh = Math.max(barW * 0.35, levels[i] * maxH);
    const x = i * slot + (slot - barW) / 2;
    const reflect = Math.min(bh * 0.32, h - baseline - px);
    roundBar(ctx, x, baseline, barW, reflect);
  }

  ctx.fillStyle = grad;
  for (let i = 0; i < count; i++) {
    const bh = Math.max(barW * 0.45, levels[i] * maxH);
    const x = i * slot + (slot - barW) / 2;
    roundBar(ctx, x, baseline - bh, barW, bh);
  }
}

function roundBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  const r = Math.min(width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, Math.max(height, r * 2), r);
  ctx.fill();
}

function drawRadial(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  px: number,
  levels: Float32Array,
  time: Uint8Array | null,
  palette: VizPalette,
  now: number,
  energy: number,
  reduced: boolean,
) {
  const cx = w / 2;
  const cy = h / 2;
  const min = Math.min(w, h);
  const inner = min * 0.16;
  const reach = min * 0.3;
  const rot = reduced ? 0 : now / 8000 + energy * 0.6;
  const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, inner + reach);
  grad.addColorStop(0, palette.low);
  grad.addColorStop(0.62, palette.mid);
  grad.addColorStop(1, palette.high);

  ctx.strokeStyle = withAlpha(palette.mid, 0.35);
  ctx.lineWidth = px;
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = grad;
  ctx.lineCap = "round";
  for (let i = 0; i < levels.length; i++) {
    const ang = rot + (i / levels.length) * Math.PI * 2;
    const len = inner * 0.08 + levels[i] * reach;
    ctx.globalAlpha = 0.45 + Math.min(1, levels[i]) * 0.55;
    ctx.lineWidth = (1.6 + levels[i] * 2.4) * px;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
    ctx.lineTo(cx + Math.cos(ang) * (inner + len), cy + Math.sin(ang) * (inner + len));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  drawWaveRing(ctx, cx, cy, inner * 0.72, time, palette, px);
}

function drawRings(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  px: number,
  levels: Float32Array,
  time: Uint8Array | null,
  palette: VizPalette,
  now: number,
  reduced: boolean,
) {
  const cx = w / 2;
  const cy = h / 2;
  const min = Math.min(w, h);
  const count = levels.length;
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const r = min * (0.12 + i * 0.055);
    const sweep = 0.45 + Math.min(1, levels[i]) * 2.15;
    const rot = reduced ? -Math.PI / 2 + i * 0.4 : now / (2600 + i * 380) + i * 0.7;
    ctx.strokeStyle = withAlpha(palette.mid, 0.16);
    ctx.lineWidth = 1.25 * px;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    const color = i % 2 === 0 ? palette.high : palette.mid;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55 + Math.min(1, levels[i]) * 0.45;
    ctx.lineWidth = (2 + levels[i] * 7) * px;
    ctx.beginPath();
    ctx.arc(cx, cy, r, rot, rot + sweep);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r, rot + Math.PI, rot + Math.PI + sweep * 0.82);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  drawWaveRing(ctx, cx, cy, min * 0.08, time, palette, px);
}

function drawWaveRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  time: Uint8Array | null,
  palette: VizPalette,
  px: number,
) {
  ctx.beginPath();
  const steps = time ? Math.min(time.length, 180) : 64;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const sample = time ? (time[Math.floor((i / steps) * (time.length - 1))] - 128) / 128 : Math.sin(t * Math.PI * 4) * 0.15;
    const r = radius * (1 + sample * 0.28);
    const ang = t * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = withAlpha(palette.high, 0.85);
  ctx.lineWidth = 1.25 * px;
  ctx.stroke();
}
