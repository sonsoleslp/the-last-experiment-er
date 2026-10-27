/**
 * The tangent tool: stage 5's whole task, and the most hands-on piece of
 * mathematics in the game.
 *
 * Instead of asking students to compute a rate of change, this asks them to
 * BUILD it. The pressure curve is drawn. The gauge reading fixes one point on
 * it. They then rotate a straight line through that point until it stops
 * cutting the curve and merely touches it, and the console reads the gradient
 * off the line they made. That gradient IS the rate of change, which is the
 * definition the whole room has been circling.
 *
 * It replaced a "type in the rate" field. That was quicker but it taught
 * nothing: a student could halve a number without ever knowing what the result
 * meant. Here the feedback is geometric and immediate. Too shallow or too
 * steep and the console says where the line cuts the curve a second time; a
 * tangent is the one line that touches once.
 *
 * DISCOVERABILITY. An early version gave only reactive feedback ("that is not
 * a tangent"), started the slider at an extreme, and deliberately refused to
 * say which way to move so the answer could not be found by bisection. The
 * result was a fifty-one position slider that was opaque to the point of being
 * unsolvable. The guard was also unnecessary: with a tool like this the
 * understanding IS the picture, so hunting for the touching line is the
 * learning rather than a way around it.
 *
 * So now: a standing instruction rather than only reactive text, a neutral
 * starting tilt, the motor limit shown throughout so the goal is visible, and
 * the valve report carries a cross-check ("the speed is half the gauge
 * reading") giving an arithmetic route to the same number. Two ways in, and
 * neither is a dead end.
 *
 * CHORD MODE exists to tie this back to stage 3. The team can place a second
 * point and see the chord's gradient, then slide that point closer and watch
 * the chord gradient converge on the tangent's. That is the definition of a
 * derivative, visible and draggable: the average rate over a shrinking
 * interval becoming the rate at an instant.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { P, VENT_K, VENT_P0, VENT_RATE_LIMIT, dP } from '../game/model';

const W = 460;
const H = 290;
const PAD = { l: 48, r: 16, t: 16, b: 40 };
const T_MAX = 8;
const P_MAX = 95;

/** Gradients the slider offers, in steps of 0.5. */
const G_MIN = -25;
const G_MAX = 0;
const G_STEP = 0.5;
/** How close a gradient must be to count as the tangent. */
const TOLERANCE = 0.3;

const sx = (t: number) => PAD.l + (t / T_MAX) * (W - PAD.l - PAD.r);
const sy = (p: number) => H - PAD.b - (p / P_MAX) * (H - PAD.t - PAD.b);

/** The time at which the pressure reads a given value. */
export const timeAtPressure = (pressure: number): number =>
  Math.log(VENT_P0 / pressure) / VENT_K;

/**
 * Does the line CROSS the curve at the chosen point, rather than touching it?
 *
 * This is the exact definition the stage turns on. The pressure curve is
 * convex, so the tangent lies below it everywhere and only meets it at the one
 * point; any other line through that point passes from one side of the curve
 * to the other there. So sampling just either side of the point and comparing
 * signs distinguishes a tangent from everything else, with no tolerance
 * fudging.
 *
 * The step h matters. It has to be small enough that the line's slope error
 * dominates the curve's bend over that distance, which needs
 * h < 2|slope error| / P''. The slider moves in 0.5 steps and P'' is at most
 * ~11 here, so anything below 0.09 is safe; 0.05 leaves good margin.
 */
const PROBE_H = 0.05;

const crossesAtPoint = (t0: number, p0: number, m: number): boolean => {
  const g = (t: number) => P(t) - (p0 + m * (t - t0));
  return Math.sign(g(t0 - PROBE_H)) !== Math.sign(g(t0 + PROBE_H));
};

/**
 * Where else the line meets the curve WITHIN THE PLOTTED RANGE, for the
 * marker. Often there is nowhere: a line only slightly off the tangent meets
 * the curve again just off the point, and a very shallow one meets it again
 * before t = 0. So this is only ever used to decorate the feedback, never to
 * decide whether the line is a tangent. An earlier version did decide on it
 * and told students their line "misses the curve" when it plainly went through
 * their point.
 */
const secondCrossing = (t0: number, p0: number, m: number): number | null => {
  const g = (t: number) => P(t) - (p0 + m * (t - t0));
  let prev = g(0);
  for (let t = 0.02; t <= T_MAX; t += 0.02) {
    const cur = g(t);
    if (Math.abs(t - t0) > 0.2 && prev !== 0 && Math.sign(cur) !== Math.sign(prev)) {
      return Math.round((t - 0.01) * 10) / 10;
    }
    prev = cur;
  }
  return null;
};

export interface TangentResult {
  /** The gradient the team settled on. */
  gradient: number;
  /** True once it matches the tangent at the gauge point. */
  isTangent: boolean;
}

export const TangentTool = ({
  pressure,
  onResult,
  locked,
}: {
  /** The gauge reading, which fixes the point on the curve. */
  pressure: number;
  onResult: (r: TangentResult) => void;
  /** Stop interaction once the reading has been accepted. */
  locked?: boolean;
}) => {
  const t0 = useMemo(() => timeAtPressure(pressure), [pressure]);
  const trueGradient = dP(t0);

  /** A neutral starting tilt: visibly wrong, and near neither answer. */
  const [m, setM] = useState(-6);
  const [mode, setMode] = useState<'tangent' | 'chord'>('tangent');
  /** Second point for chord mode, as a gap in minutes from t0. */
  const [gap, setGap] = useState(2);

  const crossing = useMemo(() => secondCrossing(t0, pressure, m), [t0, pressure, m]);
  /*
   * A tangent is decided geometrically, by whether the line crosses the curve
   * at the point, and confirmed against the true gradient. Both agree, but the
   * geometric test is the one that matches what the student can see.
   */
  const crosses = useMemo(() => crossesAtPoint(t0, pressure, m), [t0, pressure, m]);
  const isTangent = !crosses && Math.abs(m - trueGradient) < TOLERANCE;

  /*
   * Finding the tangent IS the reading, so it is reported straight away
   * instead of behind a "use this gradient" button. That removed a click and,
   * more usefully, a concept: there is no longer a separate idea of
   * "declaring" a value to the console.
   */
  const reported = useRef(false);
  useEffect(() => {
    if (locked) return;
    if (isTangent && !reported.current) {
      reported.current = true;
      onResult({ gradient: m, isTangent: true });
    }
    if (!isTangent) reported.current = false;
  }, [isTangent, locked, m, onResult]);

  // The curve.
  const path = useMemo(() => {
    const steps = 160;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = (T_MAX * i) / steps;
      return `${i === 0 ? 'M' : 'L'}${sx(t).toFixed(2)},${sy(P(t)).toFixed(2)}`;
    }).join(' ');
  }, []);

  /** The adjustable line, clipped to the plot area. */
  const line = useMemo(() => {
    const at = (t: number) => pressure + m * (t - t0);
    return { x1: sx(0), y1: sy(at(0)), x2: sx(T_MAX), y2: sy(at(T_MAX)) };
  }, [m, t0, pressure]);

  const chordEnd = Math.min(T_MAX, t0 + gap);
  const chordGradient = (P(chordEnd) - pressure) / (chordEnd - t0);

  const summary =
    mode === 'tangent'
      ? `Pressure curve with a straight line through the point at ${pressure} kilopascals. The line's gradient is ${m.toFixed(1)} kilopascals per minute. ${
          isTangent
            ? 'The line touches the curve at this point only, so it is the tangent.'
            : crossing !== null
              ? `The line also crosses the curve at t equals ${crossing} minutes, so it is not a tangent.`
              : 'The line does not meet the curve again.'
        }`
      : `Pressure curve with a chord from the point at ${pressure} kilopascals across ${gap.toFixed(
          2,
        )} minutes. The chord's gradient is ${chordGradient.toFixed(2)} kilopascals per minute, compared with ${trueGradient.toFixed(
          1,
        )} for the tangent at that point.`;

  return (
    <div className="tangent">
      {/*
        The goal, stated as a sum with the unknown marked, and visible at all
        times rather than only once the tangent is found. A player who looks at
        this panel cold should be able to see what is being asked.
      */}
      <div className="tangent-goal">
        <span>
          Pressure now <b className="mono">{pressure} kPa</b>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          falling at{' '}
          <b className="mono" data-unknown={!isTangent}>
            {isTangent ? `${Math.abs(m).toFixed(0)} kPa/min` : '? kPa/min'}
          </b>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          door opens below <b className="mono">{VENT_RATE_LIMIT} kPa/min</b>
        </span>
      </div>

      <p className="tangent-task">
        Tilt the line until it <strong>only touches</strong> the curve, without cutting through it.
      </p>

      <details className="why">
        <summary>Why tilt a line?</summary>
        <p>
          The curve is steep at the start and flatter later, so the speed the pressure falls at
          keeps changing. There is no single number to read off it.
        </p>
        <p>
          A straight line that just touches the curve at one point has the{' '}
          <strong>same steepness as the curve right there</strong>. So once your line only touches,
          how steep the line is tells you how fast the pressure is falling at that moment. That
          line is called the <strong>tangent</strong>.
        </p>
      </details>

      <div className="tangent-modes" role="group" aria-label="Measuring tool">
        <button
          className="btn btn-sm"
          aria-pressed={mode === 'tangent'}
          style={mode === 'tangent' ? { borderColor: 'var(--cyan)', color: 'var(--cyan)' } : undefined}
          onClick={() => setMode('tangent')}
        >
          Tangent
        </button>
        <button
          className="btn btn-sm"
          aria-pressed={mode === 'chord'}
          style={mode === 'chord' ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}
          onClick={() => setMode('chord')}
        >
          Chord (optional)
        </button>
      </div>

      <svg className="graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        {/* grid */}
        {[0, 19, 38, 57, 76, 95].map((p) => (
          <line key={`g${p}`} className="graph-grid" x1={PAD.l} y1={sy(p)} x2={W - PAD.r} y2={sy(p)} />
        ))}
        {[0, 2, 4, 6, 8].map((t) => (
          <line key={`v${t}`} className="graph-grid" x1={sx(t)} y1={PAD.t} x2={sx(t)} y2={H - PAD.b} />
        ))}

        {/* the gauge reading, so the point can be located on the curve */}
        <line
          x1={PAD.l}
          y1={sy(pressure)}
          x2={W - PAD.r}
          y2={sy(pressure)}
          stroke="var(--amber)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          opacity="0.8"
        />
        <text className="graph-label" x={PAD.l + 4} y={sy(pressure) - 6} fill="var(--amber)">
          gauge {pressure} kPa
        </text>

        {/* axes */}
        <line className="graph-axis" x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} />
        <line className="graph-axis" x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} />
        {[0, 2, 4, 6, 8].map((t) => (
          <text key={`t${t}`} className="graph-label" x={sx(t)} y={H - PAD.b + 15} textAnchor="middle">
            {t}
          </text>
        ))}
        {[0, 38, 76].map((p) => (
          <text key={`p${p}`} className="graph-label" x={PAD.l - 7} y={sy(p) + 3.5} textAnchor="end">
            {p}
          </text>
        ))}
        <text className="graph-label" x={(W + PAD.l) / 2} y={H - 6} textAnchor="middle">
          minutes since the valve opened
        </text>
        <text
          className="graph-label"
          x={12}
          y={(H - PAD.b + PAD.t) / 2}
          textAnchor="middle"
          transform={`rotate(-90 12 ${(H - PAD.b + PAD.t) / 2})`}
        >
          pressure (kPa)
        </text>

        {/* the curve */}
        <path className="graph-curve" d={path} />

        {mode === 'tangent' ? (
          <>
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={isTangent ? 'var(--green)' : 'var(--magenta)'}
              strokeWidth="2.5"
              strokeDasharray={isTangent ? undefined : '7 5'}
            />
            {/* where the line cuts the curve a second time */}
            {!isTangent && crossing !== null && crossing <= T_MAX && (
              <circle cx={sx(crossing)} cy={sy(P(crossing))} r="5" fill="none" stroke="var(--magenta)" strokeWidth="2" />
            )}
          </>
        ) : (
          <>
            <line
              x1={sx(t0)}
              y1={sy(pressure)}
              x2={sx(chordEnd)}
              y2={sy(P(chordEnd))}
              stroke="var(--amber)"
              strokeWidth="2.5"
            />
            <circle cx={sx(chordEnd)} cy={sy(P(chordEnd))} r="5" fill="var(--amber)" stroke="var(--bg-deep)" strokeWidth="2" />
          </>
        )}

        {/* the fixed point, always on top */}
        <circle cx={sx(t0)} cy={sy(pressure)} r="6" fill="var(--cyan)" stroke="var(--bg-deep)" strokeWidth="2" />
      </svg>

      {mode === 'tangent' ? (
        <>
          <label className="tangent-slider">
            <span>
              Line steepness <b className="mono">{m.toFixed(1)}</b> kPa/min
              {!isTangent && <em> (not the rate yet: the line is not a tangent)</em>}
            </span>
            <input
              type="range"
              min={G_MIN}
              max={G_MAX}
              step={G_STEP}
              value={m}
              disabled={locked}
              onChange={(e) => setM(Number(e.target.value))}
              aria-label="Gradient of the line, kilopascals per minute"
            />
          </label>

          <p className="tangent-feedback" data-ok={isTangent} aria-live="polite">
            {isTangent
              ? 'This line touches the curve at one point only. That is the tangent, and how steep it is tells you how fast the pressure is falling right now.'
              : crossing !== null
                ? `This line cuts straight through the curve, and comes back across it at about ${crossing} minutes. A tangent only touches.`
                : 'This line cuts through the curve instead of touching it. Keep tilting until it rests against the curve without crossing it.'}
          </p>


        </>
      ) : (
        <>
          <label className="tangent-slider">
            <span>
              Second point <b className="mono">{gap.toFixed(2)}</b> min away
            </span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={gap}
              onChange={(e) => setGap(Number(e.target.value))}
              aria-label="Distance to the second point, minutes"
            />
          </label>
          <p className="tangent-feedback">
            Average rate across the gap: <b className="mono">{chordGradient.toFixed(2)}</b> kPa/min.
            The tangent at this point is <b className="mono">{trueGradient.toFixed(1)}</b>. Slide the
            second point closer and watch the chord close in on it.
          </p>
        </>
      )}
    </div>
  );
};
