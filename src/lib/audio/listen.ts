import type { DemoId } from "@/lib/audio/demos";

export type ClipRef = { id: string; name: string };

export type ListenState = {
  kind: "none" | "mic" | "demo" | "file";
  playing: boolean;
  fileName: string;
  demoId: DemoId;
  activeFileId: string;
  time: number;
  duration: number;
  library: ClipRef[];
  fullscreen: boolean;
  error: string;
};

export const EMPTY_LISTEN: ListenState = {
  kind: "none",
  playing: false,
  fileName: "",
  demoId: "drive",
  activeFileId: "",
  time: 0,
  duration: 0,
  library: [],
  fullscreen: false,
  error: "",
};

export type ListenApi = {
  toggle: () => Promise<void>;
  skip: (dir: -1 | 1) => Promise<void>;
  seek: (seconds: number) => void;
  mic: () => Promise<void>;
  playDemo: (id: DemoId) => void;
  loadFile: (file: File) => Promise<void>;
  playClip: (id: string) => Promise<void>;
  fullscreen: () => Promise<void>;
};

export function sameListen(a: ListenState, b: ListenState) {
  if (
    a.kind !== b.kind ||
    a.playing !== b.playing ||
    a.fileName !== b.fileName ||
    a.demoId !== b.demoId ||
    a.activeFileId !== b.activeFileId ||
    a.fullscreen !== b.fullscreen ||
    a.error !== b.error ||
    Math.abs(a.time - b.time) >= 0.24 ||
    Math.abs(a.duration - b.duration) >= 0.24 ||
    a.library.length !== b.library.length
  ) {
    return false;
  }
  return a.library.every((item, index) => item.id === b.library[index]?.id && item.name === b.library[index]?.name);
}
