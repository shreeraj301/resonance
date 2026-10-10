import type { Settings, WaveName } from "@/lib/settings";

export type SynthPreset = {
  id: string;
  name: string;
  detail: string;
  wave: WaveName;
  volume: number;
  cutoff: number;
  resonance: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  bars: readonly number[];
};

export const PRESETS: readonly SynthPreset[] = [
  {
    id: "pad",
    name: "Warm Pad",
    detail: "Slow saw",
    wave: "sawtooth",
    volume: 0.55,
    cutoff: 1800,
    resonance: 0.7,
    attack: 0.45,
    decay: 0.6,
    sustain: 0.75,
    release: 1.1,
    bars: [46, 72, 88, 74, 58],
  },
  {
    id: "keys",
    name: "Soft Keys",
    detail: "Soft triangle",
    wave: "triangle",
    volume: 0.72,
    cutoff: 4200,
    resonance: 0.4,
    attack: 0.012,
    decay: 0.35,
    sustain: 0.35,
    release: 0.45,
    bars: [30, 78, 48, 86, 36],
  },
  {
    id: "bass",
    name: "Acid Bass",
    detail: "Resonant saw",
    wave: "sawtooth",
    volume: 0.7,
    cutoff: 480,
    resonance: 8,
    attack: 0.01,
    decay: 0.22,
    sustain: 0.35,
    release: 0.18,
    bars: [92, 40, 70, 34, 84],
  },
  {
    id: "lead",
    name: "Square Lead",
    detail: "Bright pulse",
    wave: "square",
    volume: 0.48,
    cutoff: 3200,
    resonance: 2.4,
    attack: 0.02,
    decay: 0.18,
    sustain: 0.7,
    release: 0.22,
    bars: [24, 88, 24, 88, 24],
  },
  {
    id: "bell",
    name: "Glass Bell",
    detail: "Short sine",
    wave: "sine",
    volume: 0.66,
    cutoff: 8000,
    resonance: 1.2,
    attack: 0.005,
    decay: 0.7,
    sustain: 0.02,
    release: 0.8,
    bars: [20, 36, 96, 44, 18],
  },
  {
    id: "sub",
    name: "Sub",
    detail: "Clean low sine",
    wave: "sine",
    volume: 0.8,
    cutoff: 260,
    resonance: 0.35,
    attack: 0.02,
    decay: 0.2,
    sustain: 0.9,
    release: 0.28,
    bars: [70, 78, 74, 80, 72],
  },
];

const CUSTOM_KEY = "resonance.custom.v1";

function near(a: number, b: number) {
  const scale = Math.max(Math.abs(a), Math.abs(b), 0.001);
  return Math.abs(a - b) / scale < 0.08;
}

export function presetPatch(preset: SynthPreset): Partial<Settings> {
  return {
    wave: preset.wave,
    volume: preset.volume,
    cutoff: preset.cutoff,
    resonance: preset.resonance,
    attack: preset.attack,
    decay: preset.decay,
    sustain: preset.sustain,
    release: preset.release,
  };
}

export function matchingPreset(settings: Settings, extra: readonly SynthPreset[] = []): SynthPreset | null {
  const all = [...extra, ...PRESETS];
  return (
    all.find(
      (preset) =>
        preset.wave === settings.wave &&
        near(preset.volume, settings.volume) &&
        near(preset.cutoff, settings.cutoff) &&
        near(preset.resonance, settings.resonance) &&
        near(preset.attack, settings.attack) &&
        near(preset.decay, settings.decay) &&
        near(preset.sustain, settings.sustain) &&
        near(preset.release, settings.release),
    ) ?? null
  );
}

export function loadCustomPreset(): SynthPreset | null {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SynthPreset>;
    if (!data || typeof data.name !== "string") return null;
    const wave = data.wave;
    if (wave !== "sine" && wave !== "triangle" && wave !== "sawtooth" && wave !== "square") return null;
    return {
      id: "custom",
      name: "Your patch",
      detail: "Saved on this device",
      wave,
      volume: num(data.volume, 0.7),
      cutoff: num(data.cutoff, 2400),
      resonance: num(data.resonance, 0.9),
      attack: num(data.attack, 0.02),
      decay: num(data.decay, 0.22),
      sustain: num(data.sustain, 0.6),
      release: num(data.release, 0.35),
      bars: [40, 65, 90, 55, 75],
    };
  } catch {
    return null;
  }
}

export function saveCustomPreset(settings: Settings): SynthPreset {
  const preset: SynthPreset = {
    id: "custom",
    name: "Your patch",
    detail: "Saved on this device",
    wave: settings.wave,
    volume: settings.volume,
    cutoff: settings.cutoff,
    resonance: settings.resonance,
    attack: settings.attack,
    decay: settings.decay,
    sustain: settings.sustain,
    release: settings.release,
    bars: [40, 65, 90, 55, 75],
  };
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(preset));
  } catch {
    /* private mode */
  }
  return preset;
}

function num(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
