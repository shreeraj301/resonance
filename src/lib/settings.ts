import { THEMES } from "@/lib/audio/themes";

export type VizMode = "bars" | "radial" | "rings";
export type WaveName = OscillatorType;
export type StudioTab = "viz" | "synth";

export type Settings = {
  tab: StudioTab;
  mode: VizMode;
  theme: string;
  sensitivity: number;
  wave: WaveName;
  octave: number;
  volume: number;
  cutoff: number;
  resonance: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  listenVolume: number;
};

export const DEFAULT_SETTINGS: Settings = {
  tab: "viz",
  mode: "bars",
  theme: "copper",
  sensitivity: 0.62,
  wave: "sawtooth",
  octave: 4,
  volume: 0.72,
  cutoff: 2400,
  resonance: 0.9,
  attack: 0.02,
  decay: 0.22,
  sustain: 0.6,
  release: 0.35,
  listenVolume: 0.85,
};

const KEY = "resonance.v1";
const MODES: readonly VizMode[] = ["bars", "radial", "rings"];
const WAVES: readonly WaveName[] = ["sine", "triangle", "sawtooth", "square"];
const TABS: readonly StudioTab[] = ["viz", "synth"];

function num(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function oneOf<T extends string>(value: unknown, list: readonly T[], fallback: T): T {
  return typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const data = JSON.parse(raw) as Partial<Settings>;
    const theme = THEMES.some((item) => item.id === data.theme) ? String(data.theme) : DEFAULT_SETTINGS.theme;
    return {
      tab: oneOf(data.tab, TABS, DEFAULT_SETTINGS.tab),
      mode: oneOf(data.mode, MODES, DEFAULT_SETTINGS.mode),
      theme,
      sensitivity: num(data.sensitivity, 0, 1, DEFAULT_SETTINGS.sensitivity),
      wave: oneOf(data.wave, WAVES, DEFAULT_SETTINGS.wave),
      octave: Math.round(num(data.octave, 2, 6, DEFAULT_SETTINGS.octave)),
      volume: num(data.volume, 0, 1, DEFAULT_SETTINGS.volume),
      cutoff: num(data.cutoff, 80, 12000, DEFAULT_SETTINGS.cutoff),
      resonance: num(data.resonance, 0.15, 12, DEFAULT_SETTINGS.resonance),
      attack: num(data.attack, 0.005, 1.2, DEFAULT_SETTINGS.attack),
      decay: num(data.decay, 0.02, 2, DEFAULT_SETTINGS.decay),
      sustain: num(data.sustain, 0, 1, DEFAULT_SETTINGS.sustain),
      release: num(data.release, 0.02, 3, DEFAULT_SETTINGS.release),
      listenVolume: num(data.listenVolume, 0, 1, DEFAULT_SETTINGS.listenVolume),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* private mode */
  }
}
