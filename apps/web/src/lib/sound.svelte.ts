import type { GameEvent } from "@shoalow/game";

const KEY = "shoalow.sound";

/**
 * Small synthesized sounds for table events: no audio files, nothing to license.
 * Browsers only allow audio after a user gesture, so the context starts on a tap. Safari on
 * iPhone and iPad only counts a finished tap, and suspends audio again when the phone locks,
 * so every tap resumes the context if it is not running.
 */
class Sound {
  enabled = $state(typeof localStorage === "undefined" || localStorage.getItem(KEY) !== "off");
  private ctx: AudioContext | null = null;
  private lastFlip = 0;

  constructor() {
    if (typeof window === "undefined") return;
    const unlock = () => {
      const ctx = this.context();
      if (ctx && ctx.state !== "running") void ctx.resume();
    };
    for (const type of ["pointerdown", "pointerup", "touchend", "click", "keydown"])
      addEventListener(type, unlock, { passive: true });
  }

  toggle(): void {
    this.enabled = !this.enabled;
    localStorage.setItem(KEY, this.enabled ? "on" : "off");
    if (this.enabled) this.chime();
  }

  private context(): AudioContext | null {
    if (!this.ctx && typeof AudioContext !== "undefined") this.ctx = new AudioContext();
    return this.ctx;
  }

  private ready(): AudioContext | null {
    if (!this.enabled) return null;
    const ctx = this.context();
    return ctx && ctx.state === "running" ? ctx : null;
  }

  /** A single enveloped oscillator note, optionally gliding to a second pitch. */
  private tone(
    freq: number,
    dur: number,
    opts: { at?: number; to?: number; type?: OscillatorType; gain?: number } = {},
  ) {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + (opts.at ?? 0);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(opts.gain ?? 0.12, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Filtered noise: the papery part of a card sound. */
  private rustle(dur: number, opts: { at?: number; freq?: number; gain?: number } = {}) {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + (opts.at ?? 0);
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = opts.freq ?? 2400;
    filter.Q.value = 0.9;
    const env = ctx.createGain();
    env.gain.value = opts.gain ?? 0.35;
    src.connect(filter).connect(env).connect(ctx.destination);
    src.start(t);
  }

  flip(): void {
    const now = performance.now();
    if (now - this.lastFlip < 70) return;
    this.lastFlip = now;
    this.rustle(0.07, { freq: 3200, gain: 0.3 });
    this.tone(520, 0.06, { to: 780, type: "triangle", gain: 0.05 });
  }

  slide(): void {
    this.rustle(0.16, { freq: 1600, gain: 0.28 });
  }

  place(): void {
    this.rustle(0.05, { freq: 900, gain: 0.35 });
    this.tone(180, 0.09, { to: 120, gain: 0.14 });
  }

  bubbles(): void {
    for (let i = 0; i < 6; i++) this.tone(420 + i * 90, 0.09, { at: i * 0.07, to: 700 + i * 120, gain: 0.07 });
  }

  chime(): void {
    this.tone(660, 0.35, { gain: 0.08 });
    this.tone(990, 0.5, { at: 0.12, gain: 0.07 });
  }

  lastCall(): void {
    this.tone(220, 0.7, { type: "triangle", gain: 0.1 });
    this.tone(165, 0.9, { at: 0.18, type: "triangle", gain: 0.08 });
  }

  fanfare(big: boolean): void {
    const notes = big ? [523, 659, 784, 1047] : [392, 523, 659];
    notes.forEach((f, i) => {
      this.tone(f, 0.4, { at: i * 0.11, type: "triangle", gain: 0.08 });
    });
  }

  /** Plays the sounds for one update's events, as seen from seat `me`. */
  play(events: GameEvent[], me: number): void {
    if (!this.enabled) return;
    for (const e of events) {
      switch (e.type) {
        case "flipped":
          this.flip();
          break;
        case "drew":
          this.slide();
          break;
        case "swapped":
        case "discarded":
          this.place();
          break;
        case "columnCleared":
          this.bubbles();
          break;
        case "finalTurns":
          this.lastCall();
          break;
        case "turnStarted":
          if (e.player === me) this.chime();
          break;
        case "roundEnded":
          this.fanfare(false);
          break;
        case "gameOver":
          this.fanfare(true);
          break;
      }
    }
  }
}

export const sound = new Sound();
