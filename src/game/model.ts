/**
 * THE LAST EXPERIMENT; the facility's physical models.
 *
 * This module is the single source of truth for every number the game shows or
 * judges. Nothing in the UI hard-codes an answer: pump readouts, temperature
 * displays, graphs, safety verdicts and the final release interlocks are all
 * derived from the functions below. That is deliberate: it means a
 * mathematically wrong choice cannot accidentally satisfy the rescue
 * conditions, because the conditions ARE the mathematics.
 *
 * Verified in tests/model.test.ts.
 */

/* ------------------------------------------------------------------ *
 * STAGE 2: Coolant pump calibration (optimisation)
 * ------------------------------------------------------------------ */

/** Coolant flow rate, L/min, as a function of regulator setting x. */
export const Q = (x: number): number => -2 * x * x + 12 * x + 5;

/** dQ/dx: how flow responds to a change in the regulator setting. */
export const dQ = (x: number): number => -4 * x + 12;

/** Regulator settings physically available on the pump. */
export const PUMP_SETTINGS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Emergency protocol minimum sustained coolant flow, L/min. */
export const MIN_FLOW = 22;

/**
 * Settings that satisfy the protocol. Computed, not asserted.
 * Q'(x) = 0 at x = 3 and Q'' = -4 < 0, so x = 3 is the maximum; Q(3) = 23,
 * and it is the only integer setting reaching 22 L/min.
 */
export const validPumpSettings = (): number[] =>
  PUMP_SETTINGS.filter((x) => Q(x) >= MIN_FLOW);

/** Tolerance on the operator's declared flow, L/min. Q is integral at integer x. */
export const PREDICTION_TOLERANCE = 0.5;

/**
 * The pump's pre-start interlock.
 *
 * Before the pump will turn over, the operator must declare the flow they
 * expect at the chosen setting; the controller compares that against the
 * calibration curve and refuses to start on a mismatch.
 *
 * This exists for a pedagogical reason, not a decorative one. The answer
 * (setting 3) is the MIDPOINT of the regulator's travel, so "just try the
 * middle one" would otherwise solve the stage by accident on the first guess,
 * and seven free test-fires would solve it by brute force with no mathematics
 * at all. Requiring a declared flow means every attempt costs an evaluation of
 * Q, and finding WHICH setting to declare is what the derivative is for.
 * Crucially, a failed check leaks nothing about the right setting.
 */
export const predictionMatches = (x: number, predicted: number): boolean =>
  Number.isFinite(predicted) && Math.abs(predicted - Q(x)) < PREDICTION_TOLERANCE;

/* ------------------------------------------------------------------ *
 * STAGE 3/4/5: Chamber thermal model (rate of change)
 * ------------------------------------------------------------------ */

/** Chamber temperature, °C, t minutes after manual cooling began. */
export const T = (t: number): number => t * t - 8 * t + 30;

/** dT/dt: instantaneous rate of temperature change, °C/min. */
export const dT = (t: number): number => 2 * t - 8;

/** The minute at which the damaged trend sensor took its last good reading. */
export const SENSOR_READING_MINUTE = 2;

/** The minute of the sensor's previous logged reading. */
export const SENSOR_LOG_START = 0;

/**
 * Average rate of change of T across an interval: the gradient of the chord.
 *
 * This exists to be WRONG in a specific, instructive way. The dead sensor left
 * two logged readings, and the obvious thing to do with two readings is divide
 * the difference. That gives the average over the interval, not the rate at
 * this moment, and in stage 3 the two give different ANSWERS and therefore
 * different ACTIONS:
 *
 *   chord over [0, 2]:  (T(2) - T(0)) / 2 = -6 deg C/min  -> exceeds the shock
 *                                                            limit -> reduce flow
 *   tangent at t = 2:   T'(2)             = -4 deg C/min  -> within the limit
 *                                                            -> maintain cooling
 *
 * The difference between a chord and a tangent is the whole idea of a
 * derivative, and here it is the difference between the right call and the
 * wrong one.
 */
export const averageRate = (t1: number, t2: number): number => (T(t2) - T(t1)) / (t2 - t1);

/**
 * Thermal shock limit, deg C/min. Cooling a sealed chamber faster than this
 * risks cracking the seal assembly, so the protocol requires flow to be cut
 * back rather than maintained.
 */
export const SHOCK_LIMIT = 5;

/**
 * The thermal channel's manual trend entry.
 *
 * With the trend sensor dead, the protocol lets an operator restore the
 * channel by entering the rate of change themselves, and the console checks
 * that figure against the calibration model before it will accept it.
 *
 * This exists for the same reason as the pump's pre-start interlock. Choosing
 * between "maintain cooling" and "activate suppression" is a binary decision,
 * so on its own it is a coin flip: a team could pass stage 3 with a 50/50
 * guess and no differentiation at all. Requiring the rate first means the
 * decision is an *interpretation of a computed value*, which is the actual
 * lesson: rather than a gamble. A sign error (+4 instead of -4) is caught
 * here too, which is the single most common mistake in this topic.
 */
export const rateMatches = (t: number, declared: number): boolean =>
  Number.isFinite(declared) && Math.abs(declared - dT(t)) < PREDICTION_TOLERANCE;

/* ------------------------------------------------------------------ *
 * STAGE 4: Release safety constraints
 * ------------------------------------------------------------------ */

/** Containment protocol: door may not open above this temperature. */
export const SAFE_TEMP_MAX = 15;

/** Dr. Vale's emergency air, in minutes from the start of manual cooling. */
export const AIR_SUPPLY_MINUTES = 3.5;

/**
 * Three instructive times, kept for the teacher guide and the test suite.
 *
 * The console no longer offers these as buttons (stage 4 asks the team to
 * solve for the earliest safe time instead), but they remain the three times
 * worth rehearsing, because each fails for a different reason:
 *   t = 2  cooling nicely, still too hot
 *   t = 3  the answer
 *   t = 4  coldest and most stable, and the air has gone
 */
export const RELEASE_CANDIDATES = [2, 3, 4] as const;

export interface SafetyCheck {
  /** Candidate release minute. */
  t: number;
  /** Predicted chamber temperature at t, °C. */
  temperature: number;
  /** Predicted rate of change at t, °C/min. */
  rate: number;
  /** Condition 1: temperature at or below the protocol maximum. */
  tempOk: boolean;
  /** Condition 2: temperature not increasing. */
  rateOk: boolean;
  /** Condition 3: emergency air still available. */
  airOk: boolean;
  /** All three conditions hold. */
  safe: boolean;
}

/** Evaluate all three interlock conditions at a candidate release minute. */
export const evaluateRelease = (t: number): SafetyCheck => {
  const temperature = T(t);
  const rate = dT(t);
  const tempOk = temperature <= SAFE_TEMP_MAX;
  const rateOk = rate <= 0;
  const airOk = t <= AIR_SUPPLY_MINUTES;
  return { t, temperature, rate, tempOk, rateOk, airOk, safe: tempOk && rateOk && airOk };
};

/**
 * The release window, solved rather than searched.
 *
 * Stage 4 asks students to find WHEN the conditions hold, not to evaluate the
 * model at times they are handed. So this computes the window the way they
 * have to:
 *
 *   (1) T(t) <= Tmax   =>  t^2 - 8t + (30 - Tmax) <= 0
 *                      =>  t in [4 - sqrt(Tmax - 14), 4 + sqrt(Tmax - 14)]
 *       with Tmax = 15 that is (t-3)(t-5) <= 0, so t in [3, 5]
 *   (2) T'(t) <= 0     =>  2t - 8 <= 0        =>  t <= 4
 *   (3) air            =>                        t <= 3.5
 *
 * Intersection: [3, 3.5]. Nothing here is hard-coded, so changing a constant
 * moves the window rather than silently breaking the stage.
 */
export const releaseWindow = (): { earliest: number; latest: number } | null => {
  const disc = SAFE_TEMP_MAX - 14; // from t^2 - 8t + (30 - Tmax) <= 0
  if (disc < 0) return null; // the chamber never gets cool enough
  const lower = 4 - Math.sqrt(disc);
  const upper = 4 + Math.sqrt(disc);
  const earliest = Math.max(lower, 0);
  const latest = Math.min(upper, 4, AIR_SUPPLY_MINUTES);
  return latest >= earliest ? { earliest, latest } : null;
};

/** The earliest moment at which all three release conditions hold. */
export const earliestSafeRelease = (): number | null => releaseWindow()?.earliest ?? null;

/* ------------------------------------------------------------------ *
 * STAGE 3; Which intervention the evidence supports
 * ------------------------------------------------------------------ */

export type Intervention = 'MAINTAIN' | 'SUPPRESSION' | 'REDUCE_FLOW';

/** Every intervention the console offers, in the order it presents them. */
export const INTERVENTIONS: Intervention[] = ['MAINTAIN', 'REDUCE_FLOW', 'SUPPRESSION'];

/**
 * Protocol TH-9, expressed as mathematics. Three branches, not two, so there
 * is no coin flip to be had even before the rate is declared:
 *
 *   T' > 0                  -> activate backup suppression
 *   T' < 0 and |T'| > limit -> reduce coolant flow (thermal shock risk)
 *   T' < 0 and |T'| <= limit-> maintain the cooling system
 */
export const interventionForRate = (rate: number): Intervention => {
  if (rate > 0) return 'SUPPRESSION';
  return Math.abs(rate) > SHOCK_LIMIT ? 'REDUCE_FLOW' : 'MAINTAIN';
};

/** The intervention the instantaneous rate at t actually calls for. */
export const correctIntervention = (t: number): Intervention => interventionForRate(dT(t));

/** Format a signed rate for instrument readouts, e.g. "-4.0 °C/min". */
export const formatRate = (r: number): string =>
  `${r > 0 ? '+' : ''}${r.toFixed(1)} °C/min`;

/* ------------------------------------------------------------------ *
 * STAGE 5: Chamber pressure vent (exponential decay)
 * ------------------------------------------------------------------ */

/**
 * The only non-polynomial model in the game, and the most interesting one.
 *
 * Opening the release valve vents the chamber's over-pressure exponentially:
 *
 *     P(t) = P0 e^(-kt)      so      dP/dt = -k P0 e^(-kt) = -k P(t)
 *
 * That last step is the whole point. The rate of change is PROPORTIONAL TO
 * WHAT IS LEFT; the defining property of exponential decay. It also makes the
 * stage solvable: the vent holds at a measured pressure without reporting how
 * long it has been running, so t is unknown. Students cannot evaluate
 * P0 e^(-kt) at all. The only route to the rate is to recognise that it is
 * -k times the pressure on the gauge.
 *
 * Teaching note: this needs d/dt e^(kt) = k e^(kt), which is a step beyond the
 * polynomial work in stages 2-4. See guides/TEACHER_GUIDE.md.
 */

/** Chamber over-pressure at the moment the vent opens, kPa. */
export const VENT_P0 = 90;

/**
 * Vent decay constant, per minute.
 *
 * Chosen as 0.5 rather than anything finer so that dP/dt = -0.5 P makes the
 * arithmetic a halving, and both hold pressures give whole-number rates
 * (34 -> 17, 22 -> 11). The stage is the last of five and its job is the
 * decision, not the sums.
 */
export const VENT_K = 0.5;

/** Over-pressure, kPa, t minutes after the release valve opens. */
export const P = (t: number): number => VENT_P0 * Math.exp(-VENT_K * t);

/** dP/dt, kPa/min. Equivalently -VENT_K * P(t). */
export const dP = (t: number): number => -VENT_K * VENT_P0 * Math.exp(-VENT_K * t);

/**
 * The rate of pressure change at a measured pressure.
 *
 * This is the form students actually need, because the gauge gives P and never
 * gives t.
 */
export const pressureRate = (pressure: number): number => -VENT_K * pressure;

/** Door actuator interlock: the wedges jam above this rate, kPa/min. */
export const VENT_RATE_LIMIT = 12;

/**
 * Pressures the vent cycle holds at, in order. Two cycles only; the vent
 * charge is spent after the second, so there is no third guess to take.
 *
 * Hold 1: 40 kPa -> falling at 20 kPa/min, over the 12 limit -> vent again
 * Hold 2: 18 kPa -> falling at  9 kPa/min, within the limit  -> open the door
 *
 * Chosen so that nothing on screen looks like anything else. With the previous
 * 34/22 the player saw a gauge of 22, a limit of 12 and an answer of 11, which
 * was three similar numbers in three different units.
 */
export const VENT_HOLDS = [40, 18] as const;

/** Is the actuator permitted to fire at this measured pressure? */
export const ventSafe = (pressure: number): boolean =>
  Math.abs(pressureRate(pressure)) <= VENT_RATE_LIMIT;

/** Tolerance on the operator's declared pressure rate, kPa/min. */
export const RATE_TOLERANCE = 0.25;

/**
 * How fast the pressure is falling, as a positive number.
 *
 * The console asks "how fast is the pressure falling?", which is a question
 * about size, and the motor limit is written as a size too ("slower than
 * 12 kPa per minute"). Asking for a magnitude rather than a signed rate takes
 * one stumbling block out of the final stage; stage 3 is where sign is taught
 * and tested.
 */
export const pressureFallRate = (pressure: number): number => Math.abs(pressureRate(pressure));

/**
 * The check the controller makes before it will run the door motor.
 *
 * Accepts the magnitude (11) or the signed rate (-11), so a student who
 * carries the minus sign through is not penalised for being more precise than
 * the question asked.
 */
export const pressureRateMatches = (pressure: number, declared: number): boolean => {
  if (!Number.isFinite(declared)) return false;
  const expected = pressureFallRate(pressure);
  return Math.abs(Math.abs(declared) - expected) < RATE_TOLERANCE;
};

/** Format a fall rate for the console, e.g. "9 kPa/min". */
export const formatPressureRate = (r: number): string => {
  const v = Math.abs(r);
  return `${Number.isInteger(v) ? v : v.toFixed(1)} kPa/min`;
};
