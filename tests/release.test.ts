/**
 * The final puzzle must never dead-end.
 *
 * Running the door motor while the pressure is still falling too fast jams it.
 * The question this file answers is the one that matters in a classroom: if a
 * team gets that wrong, are they stuck?
 *
 * Rather than reasoning about the component by eye, this walks the ENTIRE
 * reachable state space of the release controller and proves that a successful
 * release is still reachable from every state a team can reach, by any
 * sequence of actions, including the wrong ones.
 */

import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  canClearJam,
  canVent,
  fire,
  fireOutcome,
  holdPressureFor,
  initialRelease,
  isReleased,
  measure,
  type ReleaseState,
  vent,
} from '../src/game/release';
import { VENT_HOLDS, ventSafe } from '../src/game/model';

const key = (s: ReleaseState) => `${s.cycles}|${s.jammed}|${s.armed}`;

/** Every state reachable from the start by any sequence of actions. */
const reachable = (): ReleaseState[] => {
  const seen = new Map<string, ReleaseState>();
  const queue: ReleaseState[] = [initialRelease];
  seen.set(key(initialRelease), initialRelease);
  while (queue.length) {
    const s = queue.shift()!;
    for (const a of ACTIONS) {
      const next = a.apply(s);
      if (!seen.has(key(next))) {
        seen.set(key(next), next);
        queue.push(next);
      }
    }
  }
  return [...seen.values()];
};

/** Can a release be reached from here? Breadth-first over the same actions. */
const canStillWin = (from: ReleaseState): boolean => {
  const seen = new Set<string>([key(from)]);
  const queue: ReleaseState[] = [from];
  while (queue.length) {
    const s = queue.shift()!;
    if (isReleased(s)) return true;
    for (const a of ACTIONS) {
      const next = a.apply(s);
      if (!seen.has(key(next))) {
        seen.add(key(next));
        queue.push(next);
      }
    }
  }
  return false;
};

describe('the release controller cannot dead-end', () => {
  it('explores a small, fully enumerable state space', () => {
    const states = reachable();
    expect(states.length).toBeGreaterThan(3);
    expect(states.length).toBeLessThan(40);
  });

  /** The headline guarantee. */
  it('a successful release is reachable from EVERY reachable state', () => {
    for (const s of reachable()) {
      expect(canStillWin(s), `stuck at cycles=${s.cycles} jammed=${s.jammed} armed=${s.armed}`).toBe(
        true,
      );
    }
  });

  it('is still winnable after jamming the motor', () => {
    // The worst case a team can engineer: open the valve and fire immediately.
    let s = vent(initialRelease);
    s = measure(s);
    expect(fireOutcome(s)).toBe('jammed');
    s = fire(s);
    expect(s.jammed).toBe(true);
    expect(canStillWin(s)).toBe(true);
    // And the recovery is short: clear, vent, measure, fire.
    expect(canClearJam(s)).toBe(true);
  });

  it('is still winnable after spending both vent bursts', () => {
    let s = vent(vent(initialRelease));
    expect(canVent(s)).toBe(false);
    s = measure(s);
    expect(fireOutcome(s)).toBe('released');
    expect(canStillWin(s)).toBe(true);
  });

  it('is still winnable after jamming AND spending the charge', () => {
    let s = vent(initialRelease);
    s = fire(measure(s)); // jam at the first hold
    s = vent({ ...s, jammed: false }); // clear, then the second burst
    expect(canVent(s)).toBe(false);
    expect(canStillWin(s)).toBe(true);
  });

  it('jamming is only possible at the first hold, never the last', () => {
    // So a team can never jam themselves into a corner with no bursts left.
    expect(ventSafe(VENT_HOLDS[0])).toBe(false);
    expect(ventSafe(VENT_HOLDS[VENT_HOLDS.length - 1])).toBe(true);
  });

  it('the final hold is always safe to fire at, whatever came before', () => {
    const last = VENT_HOLDS.length;
    for (const jammed of [false, true]) {
      const s: ReleaseState = { cycles: last, jammed, armed: true };
      const cleared = jammed ? { ...s, jammed: false } : s;
      expect(fireOutcome(cleared)).toBe('released');
    }
  });

  it('venting always leaves the motor locked, so a stale reading cannot fire it', () => {
    const s = measure(vent(initialRelease));
    expect(s.armed).toBe(true);
    expect(vent(s).armed).toBe(false);
  });

  it('the gauge reading matches the burst count', () => {
    expect(holdPressureFor(0)).toBeNull();
    expect(holdPressureFor(1)).toBe(VENT_HOLDS[0]);
    expect(holdPressureFor(2)).toBe(VENT_HOLDS[1]);
    // Over-venting cannot run off the end of the table.
    expect(holdPressureFor(9)).toBe(VENT_HOLDS[VENT_HOLDS.length - 1]);
  });
});
