let ctx: AudioContext | null = null;
const listeners = new Set<(running: boolean) => void>();

export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function audioRunning() {
  return ctx?.state === "running";
}

export function subscribeAudio(fn: (running: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit() {
  const running = audioRunning();
  listeners.forEach((fn) => fn(!!running));
}

/** Resume inside a user gesture. Oscillators may start in the same turn. */
export function unlockAudio(): AudioContext {
  const context = getAudioContext();
  if (context.state !== "running") {
    void context.resume().then(emit, emit);
  } else {
    emit();
  }
  return context;
}
