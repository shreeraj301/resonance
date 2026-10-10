import { useEffect, useRef } from "react";

type KnobProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
  log?: boolean;
  defaultValue: number;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function toNorm(value: number, min: number, max: number, log: boolean) {
  if (log) return (Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min));
  return (value - min) / (max - min);
}

function fromNorm(norm: number, min: number, max: number, log: boolean) {
  const t = clamp01(norm);
  if (log) return Math.exp(Math.log(min) + t * (Math.log(max) - Math.log(min)));
  return min + t * (max - min);
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

export function Knob({ label, value, min, max, onChange, format, log = false, defaultValue }: KnobProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;
  const drag = useRef<{ y: number; norm: number } | null>(null);

  const norm = clamp01(toNorm(value, min, max, log));
  const start = -135;
  const end = start + norm * 270;
  const [cx, cy] = polar(32, 32, 20, end);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const current = toNorm(valueRef.current, min, max, log);
      const delta = event.deltaY > 0 ? -0.03 : 0.03;
      onChangeRef.current(fromNorm(current + delta, min, max, log));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [min, max, log]);

  return (
    <div className="flex w-16 flex-col items-center gap-1">
      <span className="text-xs text-muted">{label}</span>
      <button
        ref={ref}
        type="button"
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        className="relative size-14 rounded-full"
        onDoubleClick={() => onChange(defaultValue)}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { y: event.clientY, norm: toNorm(valueRef.current, min, max, log) };
        }}
        onPointerMove={(event) => {
          const current = drag.current;
          if (!current) return;
          const span = event.shiftKey ? 520 : 160;
          const next = clamp01(current.norm + (current.y - event.clientY) / span);
          onChangeRef.current(fromNorm(next, min, max, log));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.01 : 0.04;
          let next = toNorm(valueRef.current, min, max, log);
          if (event.key === "ArrowUp" || event.key === "ArrowRight") next += step;
          else if (event.key === "ArrowDown" || event.key === "ArrowLeft") next -= step;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = 1;
          else return;
          event.preventDefault();
          onChange(fromNorm(next, min, max, log));
        }}
      >
        <svg viewBox="0 0 64 64" className="size-14" aria-hidden="true">
          <path d={arc(32, 32, 20, -135, 135)} fill="none" stroke="var(--color-border)" strokeWidth="3" strokeLinecap="round" />
          {norm > 0.01 ? (
            <path d={arc(32, 32, 20, -135, end)} fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" />
          ) : null}
          <circle cx={cx} cy={cy} r="3.5" fill="var(--color-accent)" />
          <circle cx="32" cy="32" r="3" fill="var(--color-subtle)" />
        </svg>
      </button>
      <span className="text-xs tabular-nums text-fg">{format(value)}</span>
    </div>
  );
}
