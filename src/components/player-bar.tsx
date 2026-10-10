import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Maximize2, Minimize2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { demoById } from "@/lib/audio/demos";
import type { ListenState } from "@/lib/audio/listen";
import { themeById } from "@/lib/audio/themes";

type Props = {
  state: ListenState;
  theme: string;
  volume: number;
  onVolume: (value: number) => void;
  onToggle: () => void;
  onSkip: (dir: -1 | 1) => void;
  onSeek: (seconds: number) => void;
  onFullscreen: () => void;
};

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function artwork(state: ListenState, themeId: string) {
  const theme = themeById(themeId);
  if (state.kind === "demo") {
    const demo = demoById(state.demoId);
    return { title: demo.title, subtitle: demo.detail, low: demo.low, mid: demo.mid, high: demo.high };
  }
  if (state.kind === "file") {
    return {
      title: state.fileName || "Track",
      subtitle: "Your track",
      low: theme.low,
      mid: theme.mid,
      high: theme.high,
    };
  }
  if (state.kind === "mic") {
    return { title: "Microphone", subtitle: "Live input", low: "#10281c", mid: theme.mid, high: "#f4fff8" };
  }
  return { title: "Nothing playing", subtitle: "Pick a loop or a track", low: "#1f1f1f", mid: "#2a2a2a", high: "#3f3f3f" };
}

export function PlayerBar({ state, theme, volume, onVolume, onToggle, onSkip, onSeek, onFullscreen }: Props) {
  const remember = useRef(volume > 0.01 ? volume : 0.85);
  if (volume > 0.01) remember.current = volume;
  const art = artwork(state, theme);
  const playing = state.playing;
  const playLabel = state.kind === "mic" && playing ? "Stop microphone" : playing ? "Pause" : "Play";
  const status =
    state.kind === "demo" ? "Looping" : state.kind === "mic" ? "Listening" : state.kind === "file" ? "Track" : "Ready when you are";

  return (
    <footer className="player" aria-label="Now playing">
      <div className="player-top">
        <div className="np">
          <span
            className="cover cover-sm"
            aria-hidden="true"
            style={{ background: `linear-gradient(145deg, ${art.low}, ${art.mid} 58%, ${art.high})` }}
          />
          <div className="np-copy">
            <div className="np-title">{art.title}</div>
            <div className="np-sub">{art.subtitle}</div>
          </div>
        </div>
        <div className="transport">
          <button type="button" className="icon-btn" aria-label="Previous" onClick={() => onSkip(-1)}>
            <SkipBack className="size-5" aria-hidden="true" />
          </button>
          <button type="button" className="play-main" aria-label={playLabel} onClick={onToggle}>
            <span className="icon-swap">
              <Pause className={playing ? "size-5 swap-icon is-on" : "size-5 swap-icon is-off"} aria-hidden="true" />
              <Play className={playing ? "size-5 swap-icon is-off" : "size-5 swap-icon is-on play-nudge"} aria-hidden="true" />
            </span>
          </button>
          <button type="button" className="icon-btn" aria-label="Next" onClick={() => onSkip(1)}>
            <SkipForward className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="player-bottom">
        {state.kind === "file" && state.duration > 0 ? (
          <Seek time={state.time} duration={state.duration} onSeek={onSeek} />
        ) : (
          <p className="seek-status">{status}</p>
        )}
        <div className="volume">
          <button
            type="button"
            className="icon-btn"
            aria-label={volume > 0.01 ? "Mute" : "Unmute"}
            onClick={() => onVolume(volume > 0.01 ? 0 : remember.current)}
          >
            {volume > 0.01 ? <Volume2 className="size-4" aria-hidden="true" /> : <VolumeX className="size-4" aria-hidden="true" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            aria-label="Volume"
            style={{ "--fill": `${Math.round(volume * 100)}%` } as CSSProperties}
            onChange={(event) => onVolume(Number(event.target.value))}
          />
          <button
            type="button"
            className="icon-btn fs-only"
            aria-label={state.fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={onFullscreen}
          >
            {state.fullscreen ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </footer>
  );
}

function Seek({ time, duration, onSeek }: { time: number; duration: number; onSeek: (seconds: number) => void }) {
  const [scrub, setScrub] = useState<number | null>(null);
  const value = scrub ?? time;
  const pct = duration > 0 ? Math.min(100, (value / duration) * 100) : 0;
  return (
    <div className="seek">
      <span className="seek-time">{formatClock(value)}</span>
      <input
        type="range"
        min={0}
        max={duration}
        step={0.1}
        value={Math.min(value, duration)}
        aria-label="Seek"
        aria-valuetext={formatClock(value)}
        style={{ "--fill": `${pct}%` } as CSSProperties}
        onPointerDown={() => setScrub(time)}
        onInput={(event) => setScrub(Number(event.currentTarget.value))}
        onPointerUp={(event) => {
          onSeek(Number(event.currentTarget.value));
          setScrub(null);
        }}
        onPointerCancel={() => setScrub(null)}
        onKeyUp={(event) => {
          if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") {
            onSeek(Number(event.currentTarget.value));
          }
        }}
      />
      <span className="seek-time">{formatClock(duration)}</span>
    </div>
  );
}
