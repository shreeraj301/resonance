import { useEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import { Maximize2, Mic, Minimize2, Pause, Play, Upload } from "lucide-react";
import { unlockAudio } from "@/lib/audio/context";
import { DEMOS, type DemoId } from "@/lib/audio/demos";
import { createSmoother, drawFrame, fitCanvas } from "@/lib/audio/draw-viz";
import { EMPTY_LISTEN, type ListenApi, type ListenState } from "@/lib/audio/listen";
import { THEMES, themeById } from "@/lib/audio/themes";
import { VizSession } from "@/lib/audio/viz-session";
import type { VizMode } from "@/lib/settings";

type Props = {
  active: boolean;
  mode: VizMode;
  theme: string;
  sensitivity: number;
  volume: number;
  deckPlaying: boolean;
  onMode: (mode: VizMode) => void;
  onTheme: (id: string) => void;
  onSensitivity: (value: number) => void;
  onBrowse: () => void;
  onTransport: (state: ListenState) => void;
  onApi: (api: ListenApi) => void;
};

const MODES: { id: VizMode; label: string }[] = [
  { id: "bars", label: "Bars" },
  { id: "radial", label: "Radial" },
  { id: "rings", label: "Rings" },
];

export function VisualizerView({
  active,
  mode,
  theme,
  sensitivity,
  volume,
  deckPlaying,
  onMode,
  onTheme,
  onSensitivity,
  onBrowse,
  onTransport,
  onApi,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<VizSession | null>(null);
  const smootherRef = useRef(createSmoother());
  const binsRef = useRef({ freq: new Uint8Array(0), time: new Uint8Array(0) });
  const modeRef = useRef(mode);
  const themeRef = useRef(theme);
  const sensRef = useRef(sensitivity);
  const volumeRef = useRef(volume);
  const reducedRef = useRef(false);
  const errorRef = useRef("");
  const fsRef = useRef(false);
  const onTransportRef = useRef(onTransport);
  const ensureRef = useRef<() => VizSession>(() => {
    throw new Error("Audio is not ready");
  });
  const publishRef = useRef(() => {});
  modeRef.current = mode;
  themeRef.current = theme;
  sensRef.current = sensitivity;
  volumeRef.current = volume;
  onTransportRef.current = onTransport;

  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [shot, setShot] = useState<ListenState>(EMPTY_LISTEN);

  publishRef.current = () => {
    const session = sessionRef.current;
    const next: ListenState = session
      ? {
          kind: session.kind,
          playing: session.playing,
          fileName: session.fileName,
          demoId: session.demoId,
          activeFileId: session.activeFileId,
          time: session.currentTime,
          duration: session.duration,
          library: session.library,
          fullscreen: fsRef.current,
          error: errorRef.current,
        }
      : { ...EMPTY_LISTEN, fullscreen: fsRef.current, error: errorRef.current };
    setShot(next);
    onTransportRef.current(next);
  };

  ensureRef.current = () => {
    unlockAudio();
    if (!sessionRef.current) {
      const session = new VizSession(unlockAudio());
      session.setSensitivity(sensRef.current);
      session.setVolume(volumeRef.current);
      session.onChange = () => publishRef.current();
      sessionRef.current = session;
    }
    return sessionRef.current;
  };

  const apiRef = useRef<ListenApi | null>(null);
  if (!apiRef.current) {
    apiRef.current = {
      toggle: async () => {
        const session = ensureRef.current();
        errorRef.current = "";
        setError("");
        try {
          if (session.kind === "none") session.playDemo(session.demoId || "drive");
          else if (session.kind === "demo") session.playDemo(session.demoId);
          else if (session.kind === "mic") await session.enableMic();
          else await session.toggleFilePlayback();
        } catch {
          errorRef.current = "Couldn't play that.";
          setError(errorRef.current);
        }
        publishRef.current();
      },
      skip: async (dir) => {
        const session = ensureRef.current();
        errorRef.current = "";
        setError("");
        try {
          if (session.kind === "file" && session.library.length > 0) {
            const ids = session.library.map((item) => item.id);
            const index = Math.max(0, ids.indexOf(session.activeFileId));
            const next = ids[(index + dir + ids.length) % ids.length];
            await session.playClip(next, "start");
            return;
          }
          const ids = DEMOS.map((demo) => demo.id);
          const index = session.kind === "demo" ? ids.indexOf(session.demoId) : dir > 0 ? -1 : 0;
          const next = ids[(index + dir + ids.length) % ids.length];
          session.playDemo(next);
        } catch {
          errorRef.current = "Couldn't play that.";
          setError(errorRef.current);
          publishRef.current();
        }
      },
      seek: (seconds) => {
        sessionRef.current?.seek(seconds);
        publishRef.current();
      },
      mic: async () => {
        errorRef.current = "";
        setError("");
        try {
          await ensureRef.current().enableMic();
        } catch {
          errorRef.current = "Microphone permission was blocked.";
          setError(errorRef.current);
          publishRef.current();
        }
      },
      playDemo: (id: DemoId) => {
        errorRef.current = "";
        setError("");
        ensureRef.current().playDemo(id);
      },
      loadFile: async (file: File) => {
        errorRef.current = "";
        setError("");
        try {
          await ensureRef.current().loadFile(file);
        } catch {
          errorRef.current = "Couldn't play that file.";
          setError(errorRef.current);
          publishRef.current();
        }
      },
      playClip: async (id: string) => {
        errorRef.current = "";
        setError("");
        try {
          await ensureRef.current().playClip(id);
        } catch {
          errorRef.current = "Couldn't play that file.";
          setError(errorRef.current);
          publishRef.current();
        }
      },
      fullscreen: async () => {
        const stage = stageRef.current;
        if (!stage) return;
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await stage.requestFullscreen();
          errorRef.current = "";
          setError("");
        } catch {
          errorRef.current = "Fullscreen isn't available here.";
          setError(errorRef.current);
          publishRef.current();
        }
      },
    };
  }

  useEffect(() => {
    onApi(apiRef.current!);
  }, [onApi]);

  useEffect(() => {
    sessionRef.current?.setSensitivity(sensitivity);
  }, [sensitivity]);

  useEffect(() => {
    sessionRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      reducedRef.current = mq.matches;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const onFs = () => {
      const next = document.fullscreenElement === stageRef.current;
      fsRef.current = next;
      setFullscreen(next);
      publishRef.current();
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    return () => sessionRef.current?.dispose();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (sessionRef.current?.kind === "file") publishRef.current();
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    const loop = (now: number) => {
      fitCanvas(canvas);
      const session = sessionRef.current;
      let freq: Uint8Array | null = null;
      let time: Uint8Array | null = null;
      if (session) {
        const bins = binsRef.current;
        if (bins.freq.length !== session.analyser.frequencyBinCount) {
          bins.freq = new Uint8Array(session.analyser.frequencyBinCount);
          bins.time = new Uint8Array(session.analyser.fftSize);
        }
        session.analyser.getByteFrequencyData(bins.freq);
        session.analyser.getByteTimeDomainData(bins.time);
        freq = bins.freq;
        time = bins.time;
      }
      drawFrame(canvas, freq, time, smootherRef.current, {
        mode: modeRef.current,
        palette: themeById(themeRef.current),
        sensitivity: sensRef.current,
        now,
        reduced: reducedRef.current,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      if (event.code === "Space" && tag !== "BUTTON") {
        event.preventDefault();
        void apiRef.current?.toggle();
      } else if (event.code === "KeyF" && tag !== "BUTTON") {
        event.preventDefault();
        void apiRef.current?.fullscreen();
      } else if ((event.code === "ArrowLeft" || event.code === "ArrowRight") && sessionRef.current?.kind === "file") {
        event.preventDefault();
        const delta = event.code === "ArrowLeft" ? -5 : 5;
        sessionRef.current.seek(sessionRef.current.currentTime + delta);
        publishRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  async function takeFile(file: File | undefined) {
    if (!file) return;
    await apiRef.current?.loadFile(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    void takeFile(file);
  }

  const palette = themeById(theme);

  return (
    <div className="listen">
      <div className="toolbar">
        <div className="pill-row">
          {MODES.map((item) => (
            <button key={item.id} type="button" className="pill" aria-pressed={mode === item.id} onClick={() => onMode(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="swatches" role="group" aria-label="Color theme">
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="swatch-hit"
              aria-label={`${item.name} theme`}
              aria-pressed={theme === item.id}
              onClick={() => onTheme(item.id)}
            >
              <span className="swatch" style={{ backgroundColor: item.mid }} />
            </button>
          ))}
        </div>
        <button type="button" className="pill" aria-pressed={shot.kind === "mic"} onClick={() => void apiRef.current?.mic()}>
          <Mic className="size-4" aria-hidden="true" />
          Mic
        </button>
        <button type="button" className="pill" onClick={onBrowse}>
          <Upload className="size-4" aria-hidden="true" />
          Track
        </button>
        <label className="sens">
          <span>Level</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={sensitivity}
            aria-label="Sensitivity"
            style={{ "--fill": `${Math.round(sensitivity * 100)}%` } as CSSProperties}
            onChange={(event) => onSensitivity(Number(event.target.value))}
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="alert">
          {error}
        </p>
      ) : null}
      <div
        ref={stageRef}
        className="stage"
        onDragEnter={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
        {dragOver ? <div className="drop-veil">Drop to play</div> : null}
        <div className="stage-actions">
          <button
            type="button"
            className="icon-btn solid"
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={() => void apiRef.current?.fullscreen()}
          >
            {fullscreen ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
          </button>
        </div>
        {fullscreen ? (
          <div className="fs-overlay">
            <button type="button" className="play-main" aria-label={deckPlaying ? "Pause" : "Play"} onClick={() => void apiRef.current?.toggle()}>
              {deckPlaying ? <Pause className="size-5" aria-hidden="true" /> : <Play className="size-5 play-nudge" aria-hidden="true" />}
            </button>
          </div>
        ) : null}
      </div>
      <div className="loops" aria-label="Loops">
        {DEMOS.map((demo) => {
          const on = shot.kind === "demo" && shot.playing && shot.demoId === demo.id;
          return (
            <button key={demo.id} type="button" className="loop-chip" aria-pressed={on} onClick={() => apiRef.current?.playDemo(demo.id)}>
              <span className="loop-dot" style={{ background: demo.mid }} />
              {demo.title}
            </button>
          );
        })}
        {shot.library.map((clip) => {
          const on = shot.kind === "file" && shot.playing && shot.activeFileId === clip.id;
          return (
            <button key={clip.id} type="button" className="loop-chip" aria-pressed={on} onClick={() => void apiRef.current?.playClip(clip.id)}>
              <span className="loop-dot" style={{ background: palette.mid }} />
              {clip.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
