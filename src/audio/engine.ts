/**
 * The facility's soundscape.
 *
 * Synthesised with the Web Audio API rather than shipped as audio files, for
 * three reasons: it adds nothing to the bundle, it loops seamlessly, and
 * the real reason: it can be driven by game state. The pump's pitch rises
 * with the coolant flow it is actually delivering, and the alarm stops when
 * Dr. Vale is out. The sound carries information, not just atmosphere.
 *
 * Everything here is a redundant channel. Sound is never the only way to learn
 * anything, and the whole engine is a no-op when muted or unavailable.
 *
 * An optional `public/media/ambient.mp3` replaces the synthesised bed if
 * present; the alarm and effects stay synthesised either way.
 *
 * Browsers refuse to start audio without a user gesture, so nothing is created
 * until `unlock()` is called from a real click (the intro's "Begin
 * transmission" button).
 */

import { assetUrl } from '../game/intro';

export type Scene = 'boot' | 'lab' | 'plant' | 'thermal' | 'chamber' | 'resolved';

const MASTER_VOLUME = 0.5;
const STORAGE_KEY = 'TLE_MUTED';

interface Layer {
  gain: GainNode;
  stop: () => void;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;
let muted = readMuted();
let scene: Scene = 'boot';

let drone: Layer | null = null;
let air: Layer | null = null;
let machine: { gain: GainNode; osc: OscillatorNode; stop: () => void } | null = null;
let alarmTimer: number | null = null;
let bed: HTMLAudioElement | null = null;

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistMuted(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* private browsing; the setting just won't persist */
  }
}

/** Ramp a gain smoothly; abrupt changes click audibly. */
function ramp(node: GainNode, to: number, seconds = 0.6): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  node.gain.cancelScheduledValues(now);
  node.gain.setValueAtTime(node.gain.value, now);
  node.gain.linearRampToValueAtTime(to, now + seconds);
}

/** Two seconds of white noise, looped; the air handling and pump wash. */
function noiseBuffer(context: AudioContext): AudioBuffer {
  const length = context.sampleRate * 2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/* ------------------------------------------------------------- layers --- */

/** Deep sub-bass bed: the building itself. Detuned oscillators, slowly beating. */
function startDrone(context: AudioContext, out: GainNode): Layer {
  const gain = context.createGain();
  gain.gain.value = 0;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 180;

  const oscs = [54, 54.4, 81].map((f, i) => {
    const o = context.createOscillator();
    o.type = i === 2 ? 'triangle' : 'sine';
    o.frequency.value = f;
    const g = context.createGain();
    g.gain.value = i === 2 ? 0.25 : 1;
    o.connect(g).connect(filter);
    o.start();
    return o;
  });

  filter.connect(gain).connect(out);
  return { gain, stop: () => oscs.forEach((o) => o.stop()) };
}

/** Ventilation hiss, band-limited so it sits under everything. */
function startAir(context: AudioContext, out: GainNode): Layer {
  const src = context.createBufferSource();
  src.buffer = noiseBuffer(context);
  src.loop = true;

  const band = context.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 420;
  band.Q.value = 0.7;

  const gain = context.createGain();
  gain.gain.value = 0;

  // Very slow swell so the hiss never sounds like static.
  const lfo = context.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = context.createGain();
  lfoGain.gain.value = 0.3;
  lfo.connect(lfoGain).connect(gain.gain);
  lfo.start();

  src.connect(band).connect(gain).connect(out);
  src.start();
  return {
    gain,
    stop: () => {
      src.stop();
      lfo.stop();
    },
  };
}

/** The emergency alarm: a slow descending whoop, every few seconds. */
function alarmWhoop(): void {
  if (!ctx || !master || muted) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  const t = ctx.currentTime;
  o.frequency.setValueAtTime(440, t);
  o.frequency.exponentialRampToValueAtTime(260, t + 0.55);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.75);
}

function setAlarm(on: boolean): void {
  if (alarmTimer !== null) {
    window.clearInterval(alarmTimer);
    alarmTimer = null;
  }
  if (!on) return;
  alarmWhoop();
  alarmTimer = window.setInterval(alarmWhoop, 5200);
}

/* ------------------------------------------------------------- public --- */

/** Start audio from a user gesture. Safe to call repeatedly. */
export function unlock(): void {
  if (unlocked) return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(ctx.destination);

    // Optional external bed replaces the synthesised drone + hiss.
    const probe = new Audio(assetUrl('media/ambient.mp3'));
    probe.loop = true;
    probe.volume = 0;
    probe.addEventListener(
      'loadeddata',
      () => {
        bed = probe;
        bed.volume = muted ? 0 : 0.35;
        void bed.play().catch(() => {
          bed = null;
        });
        drone?.stop();
        air?.stop();
        drone = null;
        air = null;
      },
      { once: true },
    );
    probe.addEventListener('error', () => {}, { once: true });
    probe.load();

    drone = startDrone(ctx, master);
    air = startAir(ctx, master);
    unlocked = true;
    void ctx.resume();
    applyScene();
  } catch {
    // No Web Audio: the game is entirely playable in silence.
    ctx = null;
    master = null;
  }
}

export function isUnlocked(): boolean {
  return unlocked;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  persistMuted(value);
  if (master) ramp(master, value ? 0 : MASTER_VOLUME, 0.25);
  if (bed) bed.volume = value ? 0 : 0.35;
  if (value) setAlarm(false);
  else applyScene();
}

/** Mix for the current room. */
function applyScene(): void {
  if (!unlocked) return;
  const emergency = scene !== 'resolved' && scene !== 'boot';

  const droneLevel = scene === 'resolved' ? 0.05 : scene === 'boot' ? 0.03 : 0.09;
  const airLevel =
    scene === 'plant' ? 0.05 : scene === 'chamber' ? 0.025 : scene === 'resolved' ? 0.015 : 0.035;

  if (drone) ramp(drone.gain, droneLevel, 1.4);
  if (air) ramp(air.gain, airLevel, 1.4);
  setAlarm(emergency && !muted);
}

export function setScene(next: Scene): void {
  if (scene === next) return;
  scene = next;
  applyScene();
}

/**
 * The coolant pump. Pitch and level follow the flow actually being delivered,
 * so a team hears the machine straining at a bad setting and settling at a
 * good one; the same information the flow meter gives, in another channel.
 */
export function setPump(running: boolean, flow: number, maxFlow = 23): void {
  if (!unlocked || !ctx || !master) return;

  if (!running) {
    if (machine) {
      ramp(machine.gain, 0, 0.5);
      const m = machine;
      machine = null;
      window.setTimeout(() => m.stop(), 700);
    }
    return;
  }

  const ratio = Math.max(0, Math.min(1, flow / maxFlow));

  if (!machine) {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    // A slow tremolo gives it a rotating, mechanical feel.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.35;
    lfo.connect(lfoGain).connect(gain.gain);
    osc.connect(filter).connect(gain).connect(master);
    osc.start();
    lfo.start();
    machine = {
      gain,
      osc,
      stop: () => {
        osc.stop();
        lfo.stop();
      },
    };
  }

  const now = ctx.currentTime;
  machine.osc.frequency.cancelScheduledValues(now);
  machine.osc.frequency.setValueAtTime(machine.osc.frequency.value || 60, now);
  machine.osc.frequency.linearRampToValueAtTime(58 + ratio * 46, now + 0.8);
  ramp(machine.gain, 0.012 + ratio * 0.03, 0.8);
}

/* --------------------------------------------------------------- sfx ---- */

export type Sfx = 'click' | 'key' | 'reject' | 'accept' | 'latch' | 'lever' | 'door' | 'warn';

/** Short synthesised cues. Each one also has a visible counterpart on screen. */
export function sfx(name: Sfx): void {
  if (!unlocked || !ctx || !master || muted) return;
  const context = ctx;
  const out = master;
  const t = context.currentTime;

  const tone = (
    freq: number,
    dur: number,
    type: OscillatorType = 'sine',
    peak = 0.08,
    endFreq?: number,
  ) => {
    const o = context.createOscillator();
    const g = context.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  };

  const thud = (dur: number, peak: number, cutoff: number) => {
    const src = context.createBufferSource();
    src.buffer = noiseBuffer(context);
    const f = context.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = context.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + dur + 0.02);
  };

  switch (name) {
    case 'click':
      tone(1500, 0.05, 'square', 0.025);
      break;
    case 'key':
      tone(1100, 0.06, 'square', 0.05);
      break;
    case 'reject':
      tone(180, 0.3, 'sawtooth', 0.07, 110);
      break;
    case 'accept':
      tone(660, 0.14, 'sine', 0.07);
      window.setTimeout(() => tone(990, 0.22, 'sine', 0.06), 110);
      break;
    case 'warn':
      tone(520, 0.18, 'triangle', 0.06);
      window.setTimeout(() => tone(400, 0.26, 'triangle', 0.05), 170);
      break;
    case 'latch':
      thud(0.16, 0.14, 900);
      tone(300, 0.1, 'square', 0.03);
      break;
    case 'lever':
      thud(0.26, 0.2, 500);
      tone(90, 0.3, 'sine', 0.09, 60);
      break;
    case 'door':
      thud(1.3, 0.16, 320);
      tone(70, 1.5, 'sine', 0.07, 45);
      break;
  }
}

/** Stop everything. Used if the escape room restarts. */
export function teardown(): void {
  setAlarm(false);
  drone?.stop();
  air?.stop();
  machine?.stop();
  drone = null;
  air = null;
  machine = null;
  try {
    bed?.pause();
  } catch {
    /* ignore */
  }
  bed = null;
  try {
    void ctx?.close();
  } catch {
    /* ignore */
  }
  ctx = null;
  master = null;
  unlocked = false;
}
