import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Minus, Plus } from "lucide-react";
import { unlockAudio } from "@/lib/audio/context";
import { fitCanvas } from "@/lib/audio/draw-viz";
import { baseMidi, pianoNotes, semiFromEvent, type PianoNote } from "@/lib/audio/notes";
import { SynthEngine, type SynthParams } from "@/lib/audio/synth";
import { Knob } from "@/components/knob";
import { cn } from "@/lib/cn";
import { loadCustomPreset, matchingPreset, PRESETS, presetPatch, saveCustomPreset, type SynthPreset } from "@/lib/presets";
import { DEFAULT_SETTINGS, type Settings, type WaveName } from "@/lib/settings";

type Props = {
  active: boolean;
  settings: Settings;
  onChange: (partial: Partial<Settings>) => void;
};

const WAVES: { id: WaveName; label: string }[] = [
  { id: "sine", label: "Sine" },
  { id: "triangle", label: "Triangle" },
  { id: "sawtooth", label: "Saw" },
  { id: "square", label: "Square" },
];

function formatTime(seconds: number) {
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  return `${seconds.toFixed(2)} s`;
}

function formatHz(hz: number) {
  if (hz >= 1000) return `${(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)} kHz`;
  return `${Math.round(hz)} Hz`;
}

function paramsOf(settings: Settings): SynthParams {
  return {
    wave: settings.wave,
    volume: settings.volume,
    cutoff: settings.cutoff,
    resonance: settings.resonance,
    attack: settings.attack,
    decay: settings.decay,
    sustain: settings.sustain,
    release: settings.release,
  };
}

export function SynthView({ active, settings, onChange }: Props) {
  const engineRef = useRef<SynthEngine | null>(null);
  const paramsRef = useRef(paramsOf(settings));
  const octaveRef = useRef(settings.octave);
  const keysDown = useRef(new Set<number>());
  const pointers = useRef(new Map<number, number>());
  const sounding = useRef(new Set<number>());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const activeRef = useRef(active);
  paramsRef.current = paramsOf(settings);
  octaveRef.current = settings.octave;
  activeRef.current = active;

  const [pressed, setPressed] = useState<Set<number>>(() => new Set());
  const [custom, setCustom] = useState<SynthPreset | null>(null);

  useEffect(() => {
    setCustom(loadCustomPreset());
  }, []);

  function ensureEngine() {
    const ctx = unlockAudio();
    if (!engineRef.current) engineRef.current = new SynthEngine(ctx);
    engineRef.current.setParams(paramsRef.current);
    return engineRef.current;
  }

  function desired() {
    const notes = new Set<number>();
    const root = baseMidi(octaveRef.current);
    for (const semi of keysDown.current) notes.add(root + semi);
    for (const midi of pointers.current.values()) if (midi >= 0) notes.add(midi);
    return notes;
  }

  function sync(create: boolean) {
    const want = desired();
    if (!engineRef.current) {
      if (!create || want.size === 0) {
        setPressed(new Set(want));
        return;
      }
      ensureEngine();
    }
    const engine = engineRef.current;
    if (!engine) return;
    for (const midi of sounding.current) if (!want.has(midi)) engine.noteOff(midi);
    for (const midi of want) if (!sounding.current.has(midi)) engine.noteOn(midi);
    sounding.current = want;
    setPressed(new Set(want));
  }

  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => {
    engineRef.current?.setParams(paramsOf(settings));
  }, [settings]);

  useEffect(() => {
    keysDown.current.clear();
    pointers.current.clear();
    engineRef.current?.releaseAll();
    sounding.current = new Set();
    setPressed(new Set());
  }, [settings.octave]);

  useEffect(() => {
    if (active) return;
    keysDown.current.clear();
    pointers.current.clear();
    engineRef.current?.releaseAll();
    sounding.current = new Set();
    setPressed(new Set());
  }, [active]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (!activeRef.current || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      if (target.getAttribute("role") === "slider") return;
      if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
        event.preventDefault();
        const next = octaveRef.current + (event.code === "ArrowLeft" ? -1 : 1);
        onChange({ octave: Math.min(6, Math.max(2, next)) });
        return;
      }
      const semi = semiFromEvent(event);
      if (semi === undefined) return;
      event.preventDefault();
      keysDown.current.add(semi);
      syncRef.current(true);
    };
    const up = (event: KeyboardEvent) => {
      const semi = semiFromEvent(event);
      if (semi === undefined) return;
      keysDown.current.delete(semi);
      syncRef.current(false);
    };
    const blur = () => {
      keysDown.current.clear();
      pointers.current.clear();
      syncRef.current(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [onChange]);

  useEffect(() => {
    return () => engineRef.current?.dispose();
  }, []);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let time = new Uint8Array(0);
    let level = 0;
    const loop = () => {
      fitCanvas(canvas);
      const ctx = canvas.getContext("2d", { alpha: false });
      const engine = engineRef.current;
      if (ctx && canvas.width > 2 && canvas.height > 2) {
        let data: Uint8Array | null = null;
        if (engine) {
          if (time.length !== engine.analyser.fftSize) time = new Uint8Array(engine.analyser.fftSize);
          engine.analyser.getByteTimeDomainData(time);
          data = time;
        }
        const color = getComputedStyle(canvas).color;
        paintScope(ctx, canvas.width, canvas.height, data, color);
        level += (levelOf(data) - level) * 0.28;
        if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, level)})`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  function midiAt(event: ReactPointerEvent<HTMLDivElement>) {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const key = el?.closest("[data-midi]");
    if (!key) return -1;
    const midi = Number((key as HTMLElement).dataset.midi);
    return Number.isFinite(midi) ? midi : -1;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, midiAt(event));
    sync(true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, midiAt(event));
    sync(true);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    sync(false);
  }

  const compact = pianoNotes(settings.octave, 12);
  const wide = pianoNotes(settings.octave, 24);

  const presets = custom ? [custom, ...PRESETS] : PRESETS;
  const activePreset = matchingPreset(settings, custom ? [custom] : []);

  return (
    <div className="synth-layout">
      <div className="preset-row" aria-label="Presets">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="pill"
            aria-pressed={activePreset?.id === preset.id}
            onClick={() => onChange(presetPatch(preset))}
          >
            {preset.name}
          </button>
        ))}
        <button type="button" className="pill" onClick={() => setCustom(saveCustomPreset(settings))}>
          Save
        </button>
      </div>

      <div className="scope">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full text-accent" aria-hidden="true" />
        <div className="scope-meta">
          <span>Scope</span>
          <span>Level</span>
        </div>
        <div className="level">
          <span ref={barRef} style={{ transform: "scaleX(0)" }} />
        </div>
      </div>

      <div className="deck">
        <div className="wave-group">
          <p className="kicker">Wave</p>
          <div className="pill-row" role="group" aria-label="Waveform">
            {WAVES.map((wave) => (
              <button
                key={wave.id}
                type="button"
                className="pill"
                aria-pressed={settings.wave === wave.id}
                onClick={() => onChange({ wave: wave.id })}
              >
                {wave.label}
              </button>
            ))}
          </div>
        </div>
        <Knob
          label="Volume"
          value={settings.volume}
          min={0}
          max={1}
          defaultValue={DEFAULT_SETTINGS.volume}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(volume) => onChange({ volume })}
        />
        <Knob
          label="Cutoff"
          value={settings.cutoff}
          min={80}
          max={12000}
          log
          defaultValue={DEFAULT_SETTINGS.cutoff}
          format={formatHz}
          onChange={(cutoff) => onChange({ cutoff })}
        />
        <Knob
          label="Resonance"
          value={settings.resonance}
          min={0.15}
          max={12}
          defaultValue={DEFAULT_SETTINGS.resonance}
          format={(value) => value.toFixed(1)}
          onChange={(resonance) => onChange({ resonance })}
        />
        <Knob
          label="Attack"
          value={settings.attack}
          min={0.005}
          max={1.2}
          log
          defaultValue={DEFAULT_SETTINGS.attack}
          format={formatTime}
          onChange={(attack) => onChange({ attack })}
        />
        <Knob
          label="Decay"
          value={settings.decay}
          min={0.02}
          max={2}
          log
          defaultValue={DEFAULT_SETTINGS.decay}
          format={formatTime}
          onChange={(decay) => onChange({ decay })}
        />
        <Knob
          label="Sustain"
          value={settings.sustain}
          min={0}
          max={1}
          defaultValue={DEFAULT_SETTINGS.sustain}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(sustain) => onChange({ sustain })}
        />
        <Knob
          label="Release"
          value={settings.release}
          min={0.02}
          max={3}
          log
          defaultValue={DEFAULT_SETTINGS.release}
          format={formatTime}
          onChange={(release) => onChange({ release })}
        />
      </div>

      <div className="keys-wrap">
        <div className="keys-head">
          <div className="octave">
            <button
              type="button"
              className="icon-btn solid"
              aria-label="Octave down"
              onClick={() => onChange({ octave: Math.max(2, settings.octave - 1) })}
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span className="octave-label">Octave {settings.octave}</span>
            <button
              type="button"
              className="icon-btn solid"
              aria-label="Octave up"
              onClick={() => onChange({ octave: Math.min(6, settings.octave + 1) })}
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
          <p className="hint">A to play. Arrows shift octave.</p>
        </div>
        <div className="kb-frame">
          <Keyboard notes={compact} pressed={pressed} className="sm:hidden" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
          <Keyboard notes={wide} pressed={pressed} className="hidden sm:block" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
        </div>
      </div>
    </div>
  );
}

function Keyboard({
  notes,
  pressed,
  className,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  notes: PianoNote[];
  pressed: Set<number>;
  className?: string;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const whites = notes.filter((note) => !note.black);
  const blacks = notes
    .filter((note) => note.black)
    .map((note) => ({
      ...note,
      whiteIndex: notes.filter((item) => item.midi < note.midi && !item.black).length - 1,
    }));

  return (
    <div
      className={cn("kb", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="kb-whites">
        {whites.map((note) => (
          <div
            key={note.midi}
            data-midi={note.midi}
            role="button"
            tabIndex={-1}
            aria-label={note.letter ? `${note.name}, ${note.letter}` : note.name}
            aria-pressed={pressed.has(note.midi)}
            className={cn("white", pressed.has(note.midi) && "is-on")}
          >
            {note.letter ? <span className="text-xs">{note.letter}</span> : null}
          </div>
        ))}
      </div>
      <div className="kb-blacks" aria-hidden="false">
        {blacks.map((note) => (
          <div
            key={note.midi}
            data-midi={note.midi}
            role="button"
            tabIndex={-1}
            aria-label={note.letter ? `${note.name}, ${note.letter}` : note.name}
            aria-pressed={pressed.has(note.midi)}
            className={cn("black", pressed.has(note.midi) && "is-on")}
            style={{
              left: `${((note.whiteIndex + 1) / whites.length) * 100}%`,
              width: `${(0.62 / whites.length) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            {note.letter ? <span className="text-xs">{note.letter}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function levelOf(data: Uint8Array | null) {
  if (!data || data.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const sample = (data[i] - 128) / 128;
    sum += sample * sample;
  }
  return Math.min(1, Math.sqrt(sum / data.length) * 3.4);
}

function paintScope(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  data: Uint8Array | null,
  color: string,
) {
  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, w, h);
  const px = Math.max(1, w / 640);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = px;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.46);
  ctx.lineTo(w, h * 0.46);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.5 * px;
  ctx.beginPath();
  const steps = data ? data.length : 64;
  for (let i = 0; i < steps; i++) {
    const sample = data ? (data[i] - 128) / 128 : 0;
    const x = (i / (steps - 1)) * w;
    const y = h * 0.46 + sample * h * 0.32;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
