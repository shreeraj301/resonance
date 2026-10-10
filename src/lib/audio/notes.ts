const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const BLACK = new Set([1, 3, 6, 8, 10]);

/** Physical QWERTY positions, low C upward. */
export const CODE_TO_SEMI: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
  Quote: 17,
};

const LETTERS = ["A", "W", "S", "E", "D", "F", "T", "G", "Y", "H", "U", "J", "K", "O", "L", "P", ";", "'"];

export const KEY_TO_SEMI: Record<string, number> = {
  a: 0,
  w: 1,
  s: 2,
  e: 3,
  d: 4,
  f: 5,
  t: 6,
  g: 7,
  y: 8,
  h: 9,
  u: 10,
  j: 11,
  k: 12,
  o: 13,
  l: 14,
  p: 15,
  ";": 16,
  "'": 17,
};

export function semiFromEvent(event: { code: string; key: string }) {
  if (event.code && CODE_TO_SEMI[event.code] !== undefined) return CODE_TO_SEMI[event.code];
  return KEY_TO_SEMI[event.key] ?? KEY_TO_SEMI[event.key.toLowerCase()];
}

export type PianoNote = {
  midi: number;
  black: boolean;
  name: string;
  letter: string;
};

export function noteName(midi: number) {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NAMES[pc]}${oct}`;
}

export function midiToHz(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function baseMidi(octave: number) {
  return (octave + 1) * 12;
}

/** Inclusive semitone span from C. 12 draws C–C, 24 draws two octaves. */
export function pianoNotes(octave: number, throughSemi: number): PianoNote[] {
  const start = baseMidi(octave);
  const notes: PianoNote[] = [];
  for (let semi = 0; semi <= throughSemi; semi++) {
    const midi = start + semi;
    const pc = ((midi % 12) + 12) % 12;
    notes.push({
      midi,
      black: BLACK.has(pc),
      name: noteName(midi),
      letter: LETTERS[semi] ?? "",
    });
  }
  return notes;
}
