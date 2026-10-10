import { midiToHz } from "@/lib/audio/notes";
import type { WaveName } from "@/lib/settings";

export type SynthParams = {
  wave: WaveName;
  volume: number;
  cutoff: number;
  resonance: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
};

type Voice = {
  oscs: OscillatorNode[];
  filter: BiquadFilterNode;
  gain: GainNode;
};

const MAX_VOICES = 12;

export class SynthEngine {
  readonly analyser: AnalyserNode;
  private readonly master: GainNode;
  private readonly comp: DynamicsCompressorNode;
  private readonly voices = new Map<number, Voice>();
  private params: SynthParams = {
    wave: "sawtooth",
    volume: 0.72,
    cutoff: 2400,
    resonance: 0.9,
    attack: 0.02,
    decay: 0.22,
    sustain: 0.6,
    release: 0.35,
  };
  private disposed = false;

  constructor(private ctx: AudioContext) {
    this.master = ctx.createGain();
    this.master.gain.value = 0.3;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 16;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.18;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.72;
    this.master.connect(this.comp);
    this.comp.connect(this.analyser);
    this.analyser.connect(ctx.destination);
  }

  setParams(params: SynthParams) {
    this.params = params;
    if (this.disposed) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(Math.max(0.0001, params.volume * 0.42), t, 0.03);
    for (const voice of this.voices.values()) {
      voice.filter.frequency.setTargetAtTime(params.cutoff, t, 0.02);
      voice.filter.Q.setTargetAtTime(params.resonance, t, 0.02);
      for (const osc of voice.oscs) osc.type = params.wave;
    }
  }

  noteOn(midi: number) {
    if (this.disposed) return;
    void this.ctx.resume();
    const existing = this.voices.get(midi);
    if (existing) this.releaseVoice(midi, existing, 0.03);
    if (this.voices.size >= MAX_VOICES) {
      const oldest = this.voices.keys().next().value;
      if (oldest !== undefined) this.noteOff(oldest);
    }

    const { wave, cutoff, resonance, attack, decay, sustain } = this.params;
    const now = this.ctx.currentTime;
    const a = Math.max(0.008, attack);
    const d = Math.max(0.02, decay);
    const peak = wave === "sawtooth" || wave === "square" ? 0.11 : 0.16;
    const hold = Math.min(peak * 0.98, Math.max(0.0002, peak * sustain));

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    filter.Q.value = resonance;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + a);
    gain.gain.exponentialRampToValueAtTime(hold, now + a + d);

    const osc = this.ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = midiToHz(midi);
    osc.connect(filter);
    const oscs = [osc];

    if (wave !== "sine") {
      const twin = this.ctx.createOscillator();
      twin.type = wave;
      twin.frequency.value = midiToHz(midi);
      twin.detune.value = 8;
      const mix = this.ctx.createGain();
      mix.gain.value = 0.45;
      twin.connect(mix);
      mix.connect(filter);
      oscs.push(twin);
    }

    filter.connect(gain);
    gain.connect(this.master);
    for (const node of oscs) node.start(now);
    this.voices.set(midi, { oscs, filter, gain });
  }

  noteOff(midi: number) {
    const voice = this.voices.get(midi);
    if (!voice) return;
    this.releaseVoice(midi, voice, Math.max(0.03, this.params.release));
  }

  releaseAll() {
    for (const midi of [...this.voices.keys()]) this.noteOff(midi);
  }

  dispose() {
    this.disposed = true;
    this.releaseAll();
    try {
      this.master.disconnect();
      this.comp.disconnect();
      this.analyser.disconnect();
    } catch {
      /* already disconnected */
    }
  }

  private releaseVoice(midi: number, voice: Voice, release: number) {
    this.voices.delete(midi);
    const t = this.ctx.currentTime;
    const g = voice.gain.gain;
    g.cancelScheduledValues(t);
    const current = Math.max(0.0001, g.value);
    g.setValueAtTime(current, t);
    g.exponentialRampToValueAtTime(0.0001, t + release);
    const stopAt = t + release + 0.04;
    for (const osc of voice.oscs) {
      try {
        osc.stop(stopAt);
      } catch {
        /* already stopped */
      }
    }
    const last = voice.oscs[voice.oscs.length - 1];
    if (last) {
      last.onended = () => {
        try {
          voice.filter.disconnect();
          voice.gain.disconnect();
          for (const osc of voice.oscs) osc.disconnect();
        } catch {
          /* already disconnected */
        }
      };
    }
  }
}
