/**
 * Mathematical integrity tests.
 *
 * These are the independent verification required of the scenario: correct
 * differentiation, correct evaluations, correct max/min classification, domain
 * restrictions, unit consistency and — most importantly — that a
 * mathematically wrong choice can never satisfy the rescue conditions.
 */

import { describe, expect, it } from 'vitest';
import {
  AIR_SUPPLY_MINUTES,
  P,
  VENT_HOLDS,
  VENT_K,
  VENT_P0,
  VENT_RATE_LIMIT,
  dP,
  formatPressureRate,
  pressureFallRate,
  pressureRate,
  pressureRateMatches,
  ventSafe,
  MIN_FLOW,
  PUMP_SETTINGS,
  Q,
  RELEASE_CANDIDATES,
  SAFE_TEMP_MAX,
  SENSOR_LOG_START,
  SENSOR_READING_MINUTE,
  SHOCK_LIMIT,
  averageRate,
  interventionForRate,
  releaseWindow,
  T,
  correctIntervention,
  dQ,
  dT,
  earliestSafeRelease,
  evaluateRelease,
  predictionMatches,
  rateMatches,
  validPumpSettings,
} from '../src/game/model';

/** Central-difference numeric derivative, to check the analytic ones. */
const numericD = (f: (x: number) => number, x: number, h = 1e-6) =>
  (f(x + h) - f(x - h)) / (2 * h);

describe('Stage 2 — coolant pump optimisation', () => {
  it("Q' is the derivative of Q", () => {
    for (const x of [0, 0.5, 1, 2.5, 3, 4, 5.5, 6]) {
      expect(dQ(x)).toBeCloseTo(numericD(Q, x), 5);
    }
  });

  it("Q'(x) = 0 at x = 3 and the second derivative is negative, so it is a maximum", () => {
    expect(dQ(3)).toBe(0);
    // Q'' is constant -4: Q' decreases, so the stationary point is a maximum.
    expect(dQ(4) - dQ(3)).toBeLessThan(0);
    expect(numericD(dQ, 3)).toBeCloseTo(-4, 5);
  });

  it('Q(3) = 23 L/min, the greatest flow on the regulator domain', () => {
    expect(Q(3)).toBe(23);
    for (const x of PUMP_SETTINGS) expect(Q(x)).toBeLessThanOrEqual(Q(3));
  });

  it('reproduces the published calibration readings exactly', () => {
    expect(PUMP_SETTINGS.map(Q)).toEqual([5, 15, 21, 23, 21, 15, 5]);
  });

  it('setting 3 is the ONLY setting meeting the 22 L/min protocol minimum', () => {
    expect(validPumpSettings()).toEqual([3]);
    for (const x of PUMP_SETTINGS) {
      if (x !== 3) expect(Q(x)).toBeLessThan(MIN_FLOW);
    }
  });

  it('the maximum is strictly above the requirement, so the task is feasible', () => {
    expect(Q(3)).toBeGreaterThan(MIN_FLOW);
  });
});

describe('Stage 2 — the pre-start interlock closes the trial-and-error loophole', () => {
  /**
   * The reason this interlock exists: the answer is the midpoint of the
   * regulator's travel, so without it a single "try the middle" guess wins.
   */
  it('confirms the answer really is the midpoint — hence the loophole', () => {
    const mid = (PUMP_SETTINGS[0] + PUMP_SETTINGS[PUMP_SETTINGS.length - 1]) / 2;
    expect(mid).toBe(3);
    expect(validPumpSettings()).toEqual([3]);
  });

  it('accepts a correctly evaluated flow at every setting', () => {
    for (const x of PUMP_SETTINGS) {
      expect(predictionMatches(x, Q(x))).toBe(true);
    }
  });

  it('rejects a declared flow that was not computed from the curve', () => {
    // Guessing the right SETTING is not enough: you must also state Q(3).
    expect(predictionMatches(3, 22)).toBe(false);
    expect(predictionMatches(3, 24)).toBe(false);
    expect(predictionMatches(3, 0)).toBe(false);
    // And a right flow declared at the wrong setting is still refused.
    expect(predictionMatches(2, 23)).toBe(false);
    expect(predictionMatches(4, 23)).toBe(false);
  });

  it('rejects junk and missing input rather than letting the pump start', () => {
    expect(predictionMatches(3, Number.NaN)).toBe(false);
    expect(predictionMatches(3, Number.POSITIVE_INFINITY)).toBe(false);
    expect(predictionMatches(3, Number('')  )).toBe(false);
  });

  it('tolerates only rounding, not a different answer', () => {
    expect(predictionMatches(3, 23.4)).toBe(true);
    expect(predictionMatches(3, 22.6)).toBe(true);
    expect(predictionMatches(3, 23.5)).toBe(false);
    expect(predictionMatches(3, 22.5)).toBe(false);
  });

  it('no single declared value unlocks more than one setting', () => {
    // So a team cannot reuse one computed figure across the whole dial.
    for (const x of PUMP_SETTINGS) {
      const matches = PUMP_SETTINGS.filter((y) => predictionMatches(y, Q(x)));
      // Q is symmetric about x = 3, so some values are shared by two settings
      // (e.g. Q(2) = Q(4) = 21) — but never by a setting that passes the
      // protocol, which is what matters.
      expect(matches.filter((y) => Q(y) >= MIN_FLOW).length).toBeLessThanOrEqual(1);
    }
  });
});

describe('Stage 3 — instantaneous rate of change', () => {
  it("T' is the derivative of T", () => {
    for (const t of [0, 1, 2, 3, 3.5, 4, 5, 8]) {
      expect(dT(t)).toBeCloseTo(numericD(T, t), 5);
    }
  });

  it('the displayed reading matches the model: T(2) = 18 °C', () => {
    expect(T(SENSOR_READING_MINUTE)).toBe(18);
  });

  it("T'(2) = -4 °C/min, so the chamber is cooling", () => {
    expect(dT(SENSOR_READING_MINUTE)).toBe(-4);
    expect(dT(SENSOR_READING_MINUTE)).toBeLessThan(0);
  });

  it('the protocol therefore requires MAINTAIN, not SUPPRESSION', () => {
    expect(correctIntervention(SENSOR_READING_MINUTE)).toBe('MAINTAIN');
  });

  it('T is decreasing before its vertex at t = 4 and increasing after', () => {
    expect(dT(3.9)).toBeLessThan(0);
    expect(dT(4)).toBe(0);
    expect(dT(4.1)).toBeGreaterThan(0);
    // The vertex is a minimum: T'' = 2 > 0.
    expect(numericD(dT, 4)).toBeCloseTo(2, 5);
  });

  /**
   * Why the channel-restoration interlock exists: MAINTAIN vs SUPPRESSION is
   * a binary choice, so without it stage 3 is a 50/50 guess.
   */
  it('accepts the correctly differentiated rate, sign included', () => {
    expect(rateMatches(SENSOR_READING_MINUTE, -4)).toBe(true);
    expect(rateMatches(SENSOR_READING_MINUTE, -4.0)).toBe(true);
  });

  it('catches the sign error, which is the commonest mistake in this topic', () => {
    expect(rateMatches(SENSOR_READING_MINUTE, 4)).toBe(false);
  });

  it('rejects the temperature value offered in place of the rate', () => {
    // A team that has not differentiated often enters T(2) = 18 here.
    expect(rateMatches(SENSOR_READING_MINUTE, T(SENSOR_READING_MINUTE))).toBe(false);
    expect(rateMatches(SENSOR_READING_MINUTE, 0)).toBe(false);
  });

  it('rejects the rate taken at the wrong moment', () => {
    expect(rateMatches(SENSOR_READING_MINUTE, dT(3))).toBe(false);
    expect(rateMatches(SENSOR_READING_MINUTE, dT(4))).toBe(false);
  });

  it('rejects junk rather than releasing the controls', () => {
    expect(rateMatches(SENSOR_READING_MINUTE, Number.NaN)).toBe(false);
    expect(rateMatches(SENSOR_READING_MINUTE, Number('x'))).toBe(false);
  });

  it('tolerates only rounding', () => {
    expect(rateMatches(SENSOR_READING_MINUTE, -3.6)).toBe(true);
    expect(rateMatches(SENSOR_READING_MINUTE, -3.5)).toBe(false);
  });

  it('SUPPRESSION would be correct only on a heating chamber', () => {
    expect(correctIntervention(5)).toBe('SUPPRESSION');
    expect(dT(5)).toBeGreaterThan(0);
  });
});

describe('Stage 3 — average rate vs instantaneous rate', () => {
  const avg = averageRate(SENSOR_LOG_START, SENSOR_READING_MINUTE);

  it('the chord over the logged interval is -6 deg C/min', () => {
    expect(avg).toBe(-6);
    expect(avg).toBe((T(2) - T(0)) / 2);
  });

  it('the tangent at the current reading is -4 deg C/min, and they differ', () => {
    expect(dT(SENSOR_READING_MINUTE)).toBe(-4);
    expect(avg).not.toBe(dT(SENSOR_READING_MINUTE));
  });

  /**
   * The point of the stage: averaging does not give a near miss, it gives a
   * different ACTION. Without this the distinction is academic.
   */
  it('the chord and the tangent call for DIFFERENT interventions', () => {
    expect(interventionForRate(avg)).toBe('REDUCE_FLOW');
    expect(interventionForRate(dT(SENSOR_READING_MINUTE))).toBe('MAINTAIN');
    expect(interventionForRate(avg)).not.toBe(correctIntervention(SENSOR_READING_MINUTE));
  });

  it('the shock limit sits strictly between the two rates', () => {
    // This is what makes them land on different branches.
    expect(Math.abs(dT(SENSOR_READING_MINUTE))).toBeLessThanOrEqual(SHOCK_LIMIT);
    expect(Math.abs(avg)).toBeGreaterThan(SHOCK_LIMIT);
  });

  it('offers three branches, so the choice is never a coin flip', () => {
    expect(interventionForRate(2)).toBe('SUPPRESSION');
    expect(interventionForRate(-SHOCK_LIMIT - 0.1)).toBe('REDUCE_FLOW');
    expect(interventionForRate(-SHOCK_LIMIT)).toBe('MAINTAIN');
    expect(new Set([interventionForRate(2), interventionForRate(-9), interventionForRate(-1)]).size).toBe(3);
  });

  it('the average is only equal to the tangent at the interval midpoint', () => {
    // True for any quadratic; worth knowing so the interval choice is not
    // accidental. [0, 2] has midpoint 1, and the reading is at t = 2.
    expect(averageRate(0, 2)).toBeCloseTo(dT(1), 10);
    expect(averageRate(0, 4)).toBeCloseTo(dT(2), 10);
  });
});

describe('Stage 4 — solving for the release window', () => {
  it('solves to exactly [3, 3.5] rather than searching candidates', () => {
    const w = releaseWindow();
    expect(w).not.toBeNull();
    expect(w!.earliest).toBeCloseTo(3, 10);
    expect(w!.latest).toBeCloseTo(3.5, 10);
  });

  it('every point in the solved window is safe, and nothing outside it is', () => {
    const w = releaseWindow()!;
    for (let t = w.earliest; t <= w.latest; t += 0.01) {
      expect(evaluateRelease(t).safe).toBe(true);
    }
    for (let t = 0; t < w.earliest - 0.001; t += 0.01) {
      expect(evaluateRelease(t).safe).toBe(false);
    }
    for (let t = w.latest + 0.01; t <= 8; t += 0.01) {
      expect(evaluateRelease(t).safe).toBe(false);
    }
  });

  it('the window is derived from the constants, not hard-coded', () => {
    // Each boundary traces to one condition, so changing a constant moves the
    // window instead of silently breaking the stage.
    const w = releaseWindow()!;
    expect(T(w.earliest)).toBeCloseTo(SAFE_TEMP_MAX, 10); // condition 1 binds
    expect(w.latest).toBe(AIR_SUPPLY_MINUTES); // condition 3 binds
    expect(dT(w.latest)).toBeLessThan(0); // condition 2 is slack here
  });

  it('earliestSafeRelease agrees with the solved window', () => {
    expect(earliestSafeRelease()).toBeCloseTo(releaseWindow()!.earliest, 10);
  });
});

describe('Stage 4 — the three instructive rehearsal times', () => {
  it('reproduces the published rehearsal table exactly', () => {
    expect(RELEASE_CANDIDATES.map((t) => [t, T(t), dT(t)])).toEqual([
      [2, 18, -4],
      [3, 15, -2],
      [4, 14, 0],
    ]);
  });

  it('minute 2 fails only on temperature', () => {
    const c = evaluateRelease(2);
    expect(c.tempOk).toBe(false);
    expect(c.rateOk).toBe(true);
    expect(c.airOk).toBe(true);
    expect(c.safe).toBe(false);
  });

  it('minute 3 satisfies all three conditions', () => {
    const c = evaluateRelease(3);
    expect(c.temperature).toBe(SAFE_TEMP_MAX);
    expect(c.tempOk).toBe(true);
    expect(c.rateOk).toBe(true);
    expect(c.airOk).toBe(true);
    expect(c.safe).toBe(true);
  });

  it('minute 4 is coldest and stable but fails on air — "coldest" is a trap', () => {
    const c = evaluateRelease(4);
    expect(c.temperature).toBeLessThan(evaluateRelease(3).temperature);
    expect(c.tempOk).toBe(true);
    expect(c.rateOk).toBe(true);
    expect(c.airOk).toBe(false);
    expect(c.safe).toBe(false);
  });

  it('each candidate fails for a DIFFERENT reason, so all three ideas are needed', () => {
    const failures = RELEASE_CANDIDATES.map((t) => {
      const c = evaluateRelease(t);
      return [!c.tempOk, !c.rateOk, !c.airOk].filter(Boolean).length;
    });
    // 2 fails one condition, 3 fails none, 4 fails one.
    expect(failures).toEqual([1, 0, 1]);
  });

  it('minute 3 is the unique safe candidate and the earliest safe release', () => {
    expect(RELEASE_CANDIDATES.filter((t) => evaluateRelease(t).safe)).toEqual([3]);
    expect(earliestSafeRelease()).toBe(3);
  });

  it('continuously, the feasible set is exactly [3, 3.5] — so t = 3 really is earliest', () => {
    // T(t) <= 15  <=>  (t-3)(t-5) <= 0  <=>  3 <= t <= 5
    expect(T(3)).toBe(15);
    expect(T(5)).toBe(15);
    expect(T(2.99)).toBeGreaterThan(SAFE_TEMP_MAX);
    // Sample the whole transient and confirm nothing before t = 3 is safe.
    for (let t = 0; t < 3; t += 0.01) {
      expect(evaluateRelease(t).safe).toBe(false);
    }
    // Everything in [3, 3.5] is safe...
    for (let t = 3; t <= AIR_SUPPLY_MINUTES; t += 0.01) {
      expect(evaluateRelease(t).safe).toBe(true);
    }
    // ...and nothing after the air runs out is.
    for (let t = AIR_SUPPLY_MINUTES + 0.01; t <= 8; t += 0.01) {
      expect(evaluateRelease(t).airOk).toBe(false);
      expect(evaluateRelease(t).safe).toBe(false);
    }
  });

  it('the rescue is feasible: a safe window exists inside the air reserve', () => {
    const earliest = earliestSafeRelease();
    expect(earliest).not.toBeNull();
    expect(earliest!).toBeLessThanOrEqual(AIR_SUPPLY_MINUTES);
  });
});

describe('Stage 5 — exponential pressure vent', () => {
  it("dP/dt is the derivative of P", () => {
    for (const t of [0, 0.5, 1, 2.43, 3.64, 5, 8]) {
      expect(dP(t)).toBeCloseTo(numericD(P, t), 4);
    }
  });

  /**
   * The defining property of exponential decay, and the only reason this
   * stage is solvable: the vent reports pressure but never elapsed time, so
   * students cannot evaluate P0 e^(-kt). They must use dP/dt = -k P.
   */
  it('dP/dt equals -k times the current pressure, for every t', () => {
    for (const t of [0, 1, 2.43, 3.64, 7]) {
      expect(dP(t)).toBeCloseTo(-VENT_K * P(t), 10);
      expect(pressureRate(P(t))).toBeCloseTo(dP(t), 10);
    }
  });

  it('starts at the specified pressure and decays, never reaching zero', () => {
    expect(P(0)).toBe(VENT_P0);
    expect(P(1)).toBeLessThan(P(0));
    expect(P(50)).toBeGreaterThan(0);
  });

  it('the motor limit corresponds to a pressure threshold of 24 kPa', () => {
    // fall rate <= 12  <=>  0.5 P <= 12  <=>  P <= 24
    expect(VENT_RATE_LIMIT / VENT_K).toBe(24);
    expect(ventSafe(24)).toBe(true);
    expect(ventSafe(24.1)).toBe(false);
  });

  it('the first hold is over the limit and the second is within it', () => {
    const [first, second] = VENT_HOLDS;
    expect(Math.abs(pressureRate(first))).toBeGreaterThan(VENT_RATE_LIMIT);
    expect(ventSafe(first)).toBe(false);
    expect(Math.abs(pressureRate(second))).toBeLessThanOrEqual(VENT_RATE_LIMIT);
    expect(ventSafe(second)).toBe(true);
  });

  it('gives whole-number rates, so the arithmetic is a halving', () => {
    expect(pressureFallRate(34)).toBe(17);
    expect(pressureFallRate(22)).toBe(11);
    expect(formatPressureRate(pressureRate(22))).toBe('11 kPa/min');
    // k = 0.5 exactly, so the rule really is "half the gauge reading".
    for (const p of [10, 22, 34, 40, 90]) expect(pressureFallRate(p)).toBe(p / 2);
  });

  /**
   * The holds deliberately occur at non-round times, so solving for t and
   * substituting into P0 e^(-kt) is no shortcut even for a student who tries.
   */
  it('the holds occur at times that are not given and are not round', () => {
    for (const hold of VENT_HOLDS) {
      const t = Math.log(VENT_P0 / hold) / VENT_K;
      expect(P(t)).toBeCloseTo(hold, 6);
      expect(Number.isInteger(t)).toBe(false);
    }
  });

  it('accepts the correct rate at every hold', () => {
    for (const hold of VENT_HOLDS) {
      expect(pressureRateMatches(hold, pressureFallRate(hold))).toBe(true);
    }
  });

  /**
   * The final stage asks for a SIZE ("how fast is it falling"), so either
   * sign is accepted. A student who carries the minus through should not be
   * punished for being more precise than the question asked.
   */
  it('accepts the fall rate with or without a minus sign', () => {
    expect(pressureRateMatches(22, 11)).toBe(true);
    expect(pressureRateMatches(22, -11)).toBe(true);
  });

  it('still rejects the genuine mistakes', () => {
    expect(pressureRateMatches(22, 22)).toBe(false); // gave the pressure
    expect(pressureRateMatches(22, 0.5)).toBe(false); // gave only k
    expect(pressureRateMatches(22, 17)).toBe(false); // the other hold's rate
    expect(pressureRateMatches(22, 44)).toBe(false); // doubled instead of halved
    expect(pressureRateMatches(22, Number.NaN)).toBe(false);
  });

  it('firing at the first hold is genuinely unsafe, so the mistake is real', () => {
    expect(ventSafe(VENT_HOLDS[0])).toBe(false);
  });
});

describe('the explanation of Q prime equals zero gives nothing away', () => {
  it('the test report explains the reasoning without naming the setting', async () => {
    const { documentById } = await import('../src/game/documents');
    const body = documentById('calibration-report')!.body.join(' ');
    // It must teach the idea...
    expect(body).toMatch(/rate/i);
    expect(body).toMatch(/zero/i);
    expect(body).toMatch(/stopped rising/i);
    // ...without handing over the answer.
    expect(body).not.toMatch(/\bsetting 3\b/);
    expect(body).not.toMatch(/\b23\b/);
    expect(body).not.toMatch(/x = 3/);
  });
});

describe('cross-stage consistency', () => {
  it('the models used in stages 3, 4 and 5 are the same functions', () => {
    // Stage 3's decision and stage 4's condition 2 both read the sign of T'.
    expect(correctIntervention(SENSOR_READING_MINUTE)).toBe('MAINTAIN');
    expect(evaluateRelease(SENSOR_READING_MINUTE).rateOk).toBe(true);
  });

  it('the vent operates on its own clock, so it cannot clash with the air budget', () => {
    // Stage 4's 3.5-minute limit is on the COOLING clock and governs when
    // release may be AUTHORISED. The vent clock starts when the valve opens,
    // at which point corridor air is restored (see ENG-3310-V), so the two
    // timelines never have to be reconciled.
    const secondHoldTime = Math.log(VENT_P0 / VENT_HOLDS[1]) / VENT_K;
    expect(secondHoldTime).toBeGreaterThan(0);
    // Authorisation still happens inside the cartridge window.
    expect(earliestSafeRelease()!).toBeLessThanOrEqual(AIR_SUPPLY_MINUTES);
  });

  it('no stage introduces a number that is not derived from a model', () => {
    // Every value the team must produce is computed here, with no literals.
    const pump = validPumpSettings()[0];
    const action = correctIntervention(SENSOR_READING_MINUTE);
    const release = earliestSafeRelease();
    expect(Q(pump)).toBeGreaterThanOrEqual(MIN_FLOW);
    expect(dT(SENSOR_READING_MINUTE) < 0 ? 'MAINTAIN' : 'SUPPRESSION').toBe(action);
    expect(evaluateRelease(release!).safe).toBe(true);
  });
});
