/**
 * The tangent tool.
 *
 * Stage 5's whole task is to build a tangent and read its gradient, so the
 * geometry behind it needs checking: that the point is where the gauge says,
 * that only the true gradient touches the curve once, and that every other
 * gradient really does cut it a second time (which is what the feedback
 * message promises the student).
 */

import { describe, expect, it } from 'vitest';
import { timeAtPressure } from '../src/components/TangentTool';
import { P, VENT_HOLDS, VENT_K, VENT_P0, VENT_RATE_LIMIT, dP, ventSafe } from '../src/game/model';

/**
 * Does the line CROSS the curve at the point, rather than touch it? This
 * mirrors the tool's own test, and is the exact property its feedback claims.
 */
const H = 0.05;
const crossesAtPoint = (t0: number, p0: number, m: number): boolean => {
  const g = (t: number) => P(t) - (p0 + m * (t - t0));
  return Math.sign(g(t0 - H)) !== Math.sign(g(t0 + H));
};

describe('locating the point from the gauge', () => {
  it('maps a gauge reading back onto the curve exactly', () => {
    for (const hold of VENT_HOLDS) {
      expect(P(timeAtPressure(hold))).toBeCloseTo(hold, 8);
    }
  });

  it('puts both holds inside the plotted domain', () => {
    for (const hold of VENT_HOLDS) {
      const t = timeAtPressure(hold);
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(8);
    }
  });
});

describe('only the tangent touches once', () => {
  it('the true gradient touches rather than crosses', () => {
    for (const hold of VENT_HOLDS) {
      const t0 = timeAtPressure(hold);
      expect(crossesAtPoint(t0, hold, dP(t0))).toBe(false);
    }
  });

  /**
   * The promise the on-screen feedback makes. An earlier version tested for a
   * second crossing inside the plotted range instead, which is NOT always
   * there: a line half a step off the tangent meets the curve again just
   * beside the point, and a very shallow one meets it before t = 0. That bug
   * made the tool tell students their line "misses the curve" when it plainly
   * passed through their point.
   */
  it('every other gradient on the slider crosses the curve at the point', () => {
    for (const hold of VENT_HOLDS) {
      const t0 = timeAtPressure(hold);
      const truth = dP(t0);
      let checked = 0;
      for (let m = -25; m <= 0; m += 0.5) {
        if (Math.abs(m - truth) < 0.3) continue;
        expect(crossesAtPoint(t0, hold, m), `gradient ${m} at ${hold} kPa should cross`).toBe(true);
        checked += 1;
      }
      expect(checked).toBeGreaterThan(45);
    }
  });

  it('accepts exactly one gradient per hold, so there is a single answer', () => {
    for (const hold of VENT_HOLDS) {
      const t0 = timeAtPressure(hold);
      const accepted: number[] = [];
      for (let m = -25; m <= 0; m += 0.5) {
        if (!crossesAtPoint(t0, hold, m) && Math.abs(m - dP(t0)) < 0.3) accepted.push(m);
      }
      expect(accepted).toEqual([dP(t0)]);
    }
  });

  it('the tangent gradients land exactly on the slider steps', () => {
    // Otherwise the tool would be unwinnable.
    for (const hold of VENT_HOLDS) {
      const g = dP(timeAtPressure(hold));
      expect(Number.isInteger(g * 2)).toBe(true);
      expect(g).toBeGreaterThanOrEqual(-25);
      expect(g).toBeLessThanOrEqual(0);
    }
  });

  it('gives -20 at the first hold and -9 at the second', () => {
    expect(dP(timeAtPressure(40))).toBeCloseTo(-20, 8);
    expect(dP(timeAtPressure(18))).toBeCloseTo(-9, 8);
  });

  it('the first hold is unsafe and the second is safe, so the decision is real', () => {
    expect(ventSafe(VENT_HOLDS[0])).toBe(false);
    expect(ventSafe(VENT_HOLDS[1])).toBe(true);
    expect(Math.abs(dP(timeAtPressure(40)))).toBeGreaterThan(VENT_RATE_LIMIT);
    expect(Math.abs(dP(timeAtPressure(18)))).toBeLessThanOrEqual(VENT_RATE_LIMIT);
  });
});

describe('chord mode shows the limit', () => {
  const t0 = timeAtPressure(18);
  const chord = (gap: number) => (P(t0 + gap) - P(t0)) / gap;

  it('the chord gradient approaches the tangent as the gap shrinks', () => {
    const gaps = [3, 2, 1, 0.5, 0.25, 0.1];
    const errors = gaps.map((g) => Math.abs(chord(g) - dP(t0)));
    for (let i = 1; i < errors.length; i += 1) {
      expect(errors[i]).toBeLessThan(errors[i - 1]);
    }
    // Close enough at the smallest gap to make the point visibly.
    expect(errors[errors.length - 1]).toBeLessThan(0.3);
  });

  it('the chord is always shallower than the tangent on this curve', () => {
    // The curve is convex, so a forward chord understates how fast it is
    // falling. Exactly the stage 3 lesson, in a second setting.
    for (const g of [0.1, 0.5, 1, 2, 3]) {
      expect(chord(g)).toBeGreaterThan(dP(t0));
    }
  });
});

describe('the underlying model is unchanged', () => {
  it('still the stated exponential', () => {
    expect(VENT_P0).toBe(90);
    expect(VENT_K).toBe(0.5);
    expect(P(0)).toBe(90);
  });
});
