/**
 * The release controller, as a small state machine.
 *
 * Extracted from the stage component for one reason: an escape room must never
 * be able to dead-end. A team that jams the door motor in the final seconds of
 * a lesson and cannot recover is a disaster, and "I read the component and it
 * looked fine" is not good enough for that. With the rules as pure functions,
 * tests/release.test.ts walks the entire reachable state space and proves that
 * a successful release stays reachable from every state the team can get into.
 *
 * The states are deliberately few: how many vent bursts have been used,
 * whether the motor is jammed, and whether a measurement has unlocked it.
 */

import { VENT_HOLDS, ventSafe } from './model';

export interface ReleaseState {
  /** Vent bursts used. 0 means the valve is still shut. */
  cycles: number;
  /** The door motor stalled and the wedges are bound. */
  jammed: boolean;
  /** A tangent reading has been accepted, so the motor will run. */
  armed: boolean;
}

export const initialRelease: ReleaseState = { cycles: 0, jammed: false, armed: false };

/** Pressure the gauge is holding at, or null before the valve is opened. */
export const holdPressureFor = (cycles: number): number | null =>
  cycles <= 0 ? null : VENT_HOLDS[Math.min(cycles, VENT_HOLDS.length) - 1];

/** The valve has charge for a fixed number of bursts. */
export const canVent = (s: ReleaseState): boolean =>
  !s.jammed && s.cycles < VENT_HOLDS.length;

/** The tangent tool is available whenever the gauge is holding a reading. */
export const canMeasure = (s: ReleaseState): boolean => s.cycles > 0 && !s.jammed;

export const canFire = (s: ReleaseState): boolean => s.armed && !s.jammed;

/** Jamming is the only failure, and it is always recoverable. */
export const canClearJam = (s: ReleaseState): boolean => s.jammed;

export type FireOutcome = 'released' | 'jammed' | 'nothing';

/**
 * What happens when the motor runs. The physics decides: above the rate limit
 * the escaping air slams the door and stalls the motor.
 */
export const fireOutcome = (s: ReleaseState): FireOutcome => {
  if (!canFire(s)) return 'nothing';
  const p = holdPressureFor(s.cycles);
  if (p === null) return 'nothing';
  return ventSafe(p) ? 'released' : 'jammed';
};

export const vent = (s: ReleaseState): ReleaseState =>
  canVent(s) ? { ...s, cycles: s.cycles + 1, armed: false } : s;

export const measure = (s: ReleaseState): ReleaseState =>
  canMeasure(s) ? { ...s, armed: true } : s;

export const clearJam = (s: ReleaseState): ReleaseState =>
  s.jammed ? { ...s, jammed: false, armed: false } : s;

export const fire = (s: ReleaseState): ReleaseState => {
  const outcome = fireOutcome(s);
  if (outcome === 'jammed') return { ...s, jammed: true, armed: false };
  return s;
};

/** Every action a team can take, for exhaustive exploration. */
export const ACTIONS: { name: string; apply: (s: ReleaseState) => ReleaseState }[] = [
  { name: 'vent', apply: vent },
  { name: 'measure', apply: measure },
  { name: 'clearJam', apply: clearJam },
  { name: 'fire', apply: fire },
];

export const isReleased = (s: ReleaseState): boolean => fireOutcome(s) === 'released';
