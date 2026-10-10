export type VizPalette = {
  id: string;
  name: string;
  low: string;
  mid: string;
  high: string;
};

export const THEMES: readonly VizPalette[] = [
  { id: "copper", name: "Copper", low: "#5c3328", mid: "#c4846c", high: "#f6d7c8" },
  { id: "paper", name: "Paper", low: "#6f6b64", mid: "#d9d3c7", high: "#f7f3ec" },
  { id: "tide", name: "Tide", low: "#1d4548", mid: "#6aa8a0", high: "#d9f3ee" },
  { id: "dusk", name: "Dusk", low: "#243044", mid: "#8ea2c4", high: "#e7eef8" },
];

export function themeById(id: string): VizPalette {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}
