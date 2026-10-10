import { demoById, type DemoId } from "@/lib/audio/demos";
import { midiToHz } from "@/lib/audio/notes";

export type SourceKind = "none" | "mic" | "demo" | "file";

type Clip = { id: string; name: string; url: string };

const ARP = [57, 60, 64, 69, 67, 64, 62, 64];
const BASS = [45, 40, 41, 43];

class DemoPlayer {
  running = false;
  scene: DemoId = "drive";
  private timer = 0;
  private next = 0;
  private step = 0;
  private gen = 0;
  private readonly noise: AudioBuffer;

  constructor(
    private ctx: AudioContext,
    private viz: AudioNode,
    private hear: AudioNode,
  ) {
    const len = Math.floor(ctx.sampleRate * 0.2);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setScene(id: DemoId) {
    this.scene = id;
  }

  start() {
    this.stop();
    this.running = true;
    this.gen += 1;
    const gen = this.gen;
    this.next = this.ctx.currentTime + 0.05;
    this.step = 0;
    this.timer = window.setInterval(() => this.tick(gen), 40);
    this.tick(gen);
  }

  stop() {
    this.running = false;
    this.gen += 1;
    window.clearInterval(this.timer);
  }

  private tick(gen: number) {
    if (!this.running || gen !== this.gen) return;
    const stepDur = this.scene === "pulse" ? 0.125 : this.scene === "glass" ? 0.42 : this.scene === "low" ? 0.3 : 0.24;
    const horizon = this.ctx.currentTime + 0.32;
    while (this.next < horizon) {
      this.schedule(this.next, this.step);
      this.step += 1;
      this.next += stepDur;
    }
  }

  private schedule(time: number, step: number) {
    if (this.scene === "pulse") this.pulse(time, step);
    else if (this.scene === "glass") this.glass(time, step);
    else if (this.scene === "low") this.low(time, step);
    else this.drive(time, step);
  }

  private drive(time: number, step: number) {
    this.blip(ARP[step % ARP.length], time, 0.22, "triangle", 0.07);
    if (step % 4 === 0) this.blip(BASS[Math.floor(step / 4) % BASS.length], time, 0.5, "sine", 0.1);
  }

  private pulse(time: number, step: number) {
    if (step % 4 === 0) this.kick(time);
    if (step % 2 === 0) this.noiseHit(time, 0.045, 6800, 0.05);
    if (step % 8 === 4) this.noiseHit(time, 0.14, 1200, 0.09);
  }

  private glass(time: number, step: number) {
    const notes = [76, 79, 83, 88, 86, 83, 79, 74];
    this.blip(notes[step % notes.length], time, 1.05, "sine", 0.06);
    if (step % 4 === 0) this.blip(52, time, 1.3, "triangle", 0.035);
  }

  private low(time: number, step: number) {
    const notes = [36, 36, 38, 34, 36, 31, 34, 36];
    this.sweep(notes[step % notes.length], time);
  }

  private blip(midi: number, time: number, dur: number, type: OscillatorType, amp: number) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = midiToHz(midi);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1600, time);
    filter.frequency.exponentialRampToValueAtTime(380, time + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(amp, time + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.viz);
    gain.connect(this.hear);
    osc.start(time);
    osc.stop(time + dur + 0.03);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  private kick(time: number) {
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(148, time);
    osc.frequency.exponentialRampToValueAtTime(46, time + 0.12);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.22, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    osc.connect(gain);
    gain.connect(this.viz);
    gain.connect(this.hear);
    osc.start(time);
    osc.stop(time + 0.26);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  private noiseHit(time: number, dur: number, freq: number, amp: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(amp, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.viz);
    gain.connect(this.hear);
    src.start(time);
    src.stop(time + dur + 0.02);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  private sweep(midi: number, time: number) {
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = midiToHz(midi);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 7;
    filter.frequency.setValueAtTime(180, time);
    filter.frequency.exponentialRampToValueAtTime(1400, time + 0.08);
    filter.frequency.exponentialRampToValueAtTime(220, time + 0.28);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.07, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.viz);
    gain.connect(this.hear);
    osc.start(time);
    osc.stop(time + 0.34);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
}

export class VizSession {
  readonly analyser: AnalyserNode;
  kind: SourceKind = "none";
  fileName = "";
  demoId: DemoId = "drive";
  activeFileId = "";
  onChange: (() => void) | null = null;

  private readonly input: GainNode;
  private readonly hear: GainNode;
  private readonly comp: DynamicsCompressorNode;
  private fileEl: HTMLAudioElement | null = null;
  private fileNode: MediaElementAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private micNode: MediaStreamAudioSourceNode | null = null;
  private clips: Clip[] = [];
  private readonly demo: DemoPlayer;
  private micPending = false;

  constructor(private ctx: AudioContext) {
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 18;
    this.comp.ratio.value = 3.5;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.18;
    this.comp.connect(ctx.destination);

    this.hear = ctx.createGain();
    this.hear.gain.value = 0.85;
    this.hear.connect(this.comp);

    this.input = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.55;
    this.analyser.minDecibels = -100;
    this.analyser.maxDecibels = -30;
    this.input.connect(this.analyser);
    this.demo = new DemoPlayer(ctx, this.input, this.hear);
    this.setSensitivity(0.62);
  }

  get library() {
    return this.clips.map(({ id, name }) => ({ id, name }));
  }

  setVolume(amount: number) {
    const v = Math.min(1, Math.max(0, amount));
    this.hear.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
  }

  setSensitivity(amount: number) {
    const s = Math.min(1, Math.max(0, amount));
    this.input.gain.setTargetAtTime(0.65 + s * 1.7, this.ctx.currentTime, 0.04);
    this.analyser.maxDecibels = -14 - s * 26;
  }

  get playing() {
    if (this.kind === "file") return !!this.fileEl && !this.fileEl.paused;
    if (this.kind === "demo") return this.demo.running;
    if (this.kind === "mic") return !!this.micNode;
    return false;
  }

  get currentTime() {
    return this.fileEl?.currentTime ?? 0;
  }

  get duration() {
    const d = this.fileEl?.duration ?? 0;
    return Number.isFinite(d) ? d : 0;
  }

  async enableMic() {
    if (this.micPending) return;
    if (this.micNode) {
      this.stopMic();
      this.kind = "none";
      this.emit();
      return;
    }
    this.demo.stop();
    this.fileEl?.pause();
    this.kind = "none";
    this.emit();
    this.micPending = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      this.micStream = stream;
      this.micNode = this.ctx.createMediaStreamSource(stream);
      this.micNode.connect(this.input);
      this.kind = "mic";
      this.emit();
    } finally {
      this.micPending = false;
    }
  }

  playDemo(id: DemoId) {
    const demo = demoById(id);
    this.stopMic();
    this.fileEl?.pause();
    if (this.kind === "demo" && this.demoId === demo.id && this.demo.running) {
      this.demo.stop();
      this.kind = "none";
      this.emit();
      return;
    }
    this.demoId = demo.id;
    this.demo.setScene(demo.id);
    this.kind = "demo";
    this.demo.start();
    this.emit();
  }

  seek(seconds: number) {
    const el = this.fileEl;
    if (!el || this.kind !== "file") return;
    const d = this.duration;
    const next = Math.max(0, d > 0 ? Math.min(d - 0.05, seconds) : seconds);
    el.currentTime = Number.isFinite(next) ? next : 0;
    this.emit();
  }

  async loadFile(file: File) {
    this.stopMic();
    this.demo.stop();
    this.ensureFile();
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^.]+$/, "") || "Track";
    const item: Clip = { id: crypto.randomUUID(), name, url };
    const next = [item, ...this.clips].slice(0, 6);
    for (const old of this.clips) {
      if (!next.some((clip) => clip.id === old.id)) URL.revokeObjectURL(old.url);
    }
    this.clips = next;
    await this.playClip(item.id, "start");
  }

  async playClip(id: string, behavior: "toggle" | "start" = "toggle") {
    const item = this.clips.find((clip) => clip.id === id);
    const el = this.fileEl;
    if (!item || !el) return;
    this.stopMic();
    this.demo.stop();
    if (this.activeFileId === id && this.kind === "file") {
      if (behavior === "toggle") {
        if (el.paused) await el.play();
        else el.pause();
      } else if (el.paused) {
        await el.play();
      } else {
        el.currentTime = 0;
      }
      this.emit();
      return;
    }
    this.activeFileId = id;
    this.fileName = item.name;
    el.src = item.url;
    this.kind = "file";
    await el.play();
    this.emit();
  }

  async toggleFilePlayback() {
    if (!this.fileEl) return;
    this.stopMic();
    this.demo.stop();
    this.kind = "file";
    if (this.fileEl.paused) await this.fileEl.play();
    else this.fileEl.pause();
    this.emit();
  }

  dispose() {
    this.demo.stop();
    this.stopMic();
    this.fileEl?.pause();
    for (const clip of this.clips) URL.revokeObjectURL(clip.url);
    this.clips = [];
    try {
      this.input.disconnect();
      this.hear.disconnect();
      this.comp.disconnect();
    } catch {
      /* already stopped */
    }
  }

  private ensureFile() {
    if (this.fileEl && this.fileNode) return;
    const el = new Audio();
    el.preload = "auto";
    const emit = () => this.emit();
    el.addEventListener("play", emit);
    el.addEventListener("pause", emit);
    el.addEventListener("ended", () => {
      this.kind = "file";
      emit();
    });
    el.addEventListener("loadedmetadata", emit);
    this.fileNode = this.ctx.createMediaElementSource(el);
    this.fileNode.connect(this.hear);
    this.fileNode.connect(this.input);
    this.fileEl = el;
  }

  private stopMic() {
    this.micNode?.disconnect();
    this.micNode = null;
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
  }

  private emit() {
    this.onChange?.();
  }
}
