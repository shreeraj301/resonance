import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeAudio, unlockAudio } from "@/lib/audio/context";
import { EMPTY_LISTEN, sameListen, type ListenApi, type ListenState } from "@/lib/audio/listen";
import { PlayerBar } from "@/components/player-bar";
import { SynthView } from "@/components/synth-view";
import { VisualizerView } from "@/components/visualizer-view";
import { cn } from "@/lib/cn";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "@/lib/settings";

export function Studio() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(false);
  const [listen, setListen] = useState<ListenState>(EMPTY_LISTEN);
  const apiRef = useRef<ListenApi | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const takeApi = useCallback((api: ListenApi) => {
    apiRef.current = api;
  }, []);
  const onTransport = useCallback((next: ListenState) => {
    setListen((prev) => (sameListen(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    setSettings(loadSettings());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveSettings(settings);
  }, [settings, ready]);

  useEffect(() => subscribeAudio(setLive), []);

  useEffect(() => {
    if (live) return;
    const go = () => unlockAudio();
    window.addEventListener("pointerdown", go);
    window.addEventListener("keydown", go);
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
  }, [live]);

  const patch = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  return (
    <div className="shell">
      <div className="workspace">
        <header className="topbar">
          <div className="brand">
            <span className="mark" aria-hidden="true">
              <Mark />
            </span>
            <span className="brand-name">Resonance</span>
            <span className={cn("live-dot", live && "on")} title={live ? "Audio on" : "Tap for audio"} />
          </div>
          <div className="tabs" role="tablist" aria-label="Studio">
            <button type="button" role="tab" aria-selected={settings.tab === "viz"} onClick={() => patch({ tab: "viz" })}>
              Listen
            </button>
            <button type="button" role="tab" aria-selected={settings.tab === "synth"} onClick={() => patch({ tab: "synth" })}>
              Synth
            </button>
          </div>
        </header>
        <main>
          <div className={settings.tab === "viz" ? "pane" : "pane hidden"}>
            <VisualizerView
              active={settings.tab === "viz"}
              mode={settings.mode}
              theme={settings.theme}
              sensitivity={settings.sensitivity}
              volume={settings.listenVolume}
              deckPlaying={listen.playing}
              onMode={(mode) => patch({ mode })}
              onTheme={(theme) => patch({ theme })}
              onSensitivity={(sensitivity) => patch({ sensitivity })}
              onBrowse={() => fileRef.current?.click()}
              onTransport={onTransport}
              onApi={takeApi}
            />
          </div>
          <div className={settings.tab === "synth" ? "pane" : "pane hidden"}>
            <SynthView active={settings.tab === "synth"} settings={settings} onChange={patch} />
          </div>
        </main>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void apiRef.current?.loadFile(file);
          }}
        />
      </div>
      <PlayerBar
        state={listen}
        theme={settings.theme}
        volume={settings.listenVolume}
        onVolume={(listenVolume) => patch({ listenVolume })}
        onToggle={() => void apiRef.current?.toggle()}
        onSkip={(dir) => void apiRef.current?.skip(dir)}
        onSeek={(seconds) => apiRef.current?.seek(seconds)}
        onFullscreen={() => void apiRef.current?.fullscreen()}
      />
    </div>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path d="M6.5 15.5v-6M12 17.5v-11M17.5 14.5v-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
