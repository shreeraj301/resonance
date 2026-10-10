export type DemoId = "drive" | "pulse" | "glass" | "low";

export type DemoTrack = {
  id: DemoId;
  title: string;
  detail: string;
  low: string;
  mid: string;
  high: string;
};

export const DEMOS: readonly DemoTrack[] = [
  {
    id: "drive",
    title: "Night Drive",
    detail: "Arp and bass",
    low: "#123c2b",
    mid: "#1ed760",
    high: "#e9fff2",
  },
  {
    id: "pulse",
    title: "Pulse Room",
    detail: "Kick and hats",
    low: "#3a1820",
    mid: "#f3727f",
    high: "#ffe4e8",
  },
  {
    id: "glass",
    title: "Glass Hours",
    detail: "Slow bells",
    low: "#17283f",
    mid: "#7eb6ff",
    high: "#eef5ff",
  },
  {
    id: "low",
    title: "Subfloor",
    detail: "Filtered bass",
    low: "#2c2112",
    mid: "#ffa42b",
    high: "#fff1d6",
  },
];

export function demoById(id: string): DemoTrack {
  return DEMOS.find((demo) => demo.id === id) ?? DEMOS[0];
}
