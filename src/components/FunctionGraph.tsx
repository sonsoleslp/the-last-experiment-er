/**
 * Instrument-style plot of a model function, with optional tangent line.
 *
 * The tangent is the point of this component: it makes the derivative visible
 * as the slope of the curve at a moment, which is what the team is being asked
 * to reason about. The tangent's slope is computed from the supplied derivative
 * function, so it is never drawn as a decorative approximation.
 *
 * A text summary of every plotted feature is exposed to screen readers, so the
 * graph is not a visual-only clue.
 */

export interface Marker {
  x: number;
  label?: string;
}

interface Props {
  /** The function to plot. */
  f: (x: number) => number;
  /** Its derivative, used to draw a tangent at `tangentAt`. */
  df?: (x: number) => number;
  domain: [number, number];
  range: [number, number];
  xLabel: string;
  yLabel: string;
  /** Draw a tangent line at this x, illustrating the instantaneous rate. */
  tangentAt?: number | null;
  /** Horizontal threshold line (e.g. the 15 °C containment limit). */
  limit?: { y: number; label: string };
  /** Points to mark on the curve. */
  markers?: Marker[];
  /** Accessible description prefix. */
  caption: string;
  /**
   * Draw the function itself. Set false to show only the threshold, the axes
   * and any marked points, turning the panel into an instrument record rather
   * than a plotter. Stage 2 uses this so the maximum of the flow curve cannot
   * be read off a pre-drawn parabola.
   */
  showCurve?: boolean;
  /**
   * Draw the x-axis tick labels and vertical gridlines.
   *
   * Stage 2 turns these OFF. The shape of the flow curve is the motivation
   * for the whole stage (it rises, peaks, and falls again, so there is a best
   * setting to find), but a labelled x-axis would let the peak be read
   * straight off the plot, and countable gridlines would do the same job. With
   * both gone the curve shows the shape without giving away which setting the
   * peak sits at.
   */
  xTicks?: boolean;
}

const W = 420;
const H = 260;
const PAD = { l: 44, r: 14, t: 14, b: 34 };

export const FunctionGraph = ({
  f,
  df,
  domain,
  range,
  xLabel,
  yLabel,
  tangentAt,
  limit,
  markers = [],
  caption,
  showCurve = true,
  xTicks = true,
}: Props) => {
  const [x0, x1] = domain;
  const [y0, y1] = range;

  const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => H - PAD.b - ((y - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);

  // Sample the curve densely enough that a quadratic looks smooth.
  const steps = 120;
  const path = Array.from({ length: steps + 1 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / steps;
    return `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(2)},${sy(f(x)).toFixed(2)}`;
  }).join(' ');

  const xTickValues = Array.from({ length: Math.floor(x1 - x0) + 1 }, (_, i) => x0 + i);
  const yStep = (y1 - y0) / 4;
  const yTicks = Array.from({ length: 5 }, (_, i) => y0 + i * yStep);

  // Tangent through (t, f(t)) with slope f'(t), clipped to the domain.
  let tangent: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (showCurve && typeof tangentAt === 'number' && df) {
    const t = tangentAt;
    const m = df(t);
    const b = f(t) - m * t;
    const span = (x1 - x0) * 0.3;
    const ta = Math.max(x0, t - span);
    const tb = Math.min(x1, t + span);
    tangent = { x1: sx(ta), y1: sy(m * ta + b), x2: sx(tb), y2: sy(m * tb + b) };
  }

  const summary = [
    caption,
    showCurve && typeof tangentAt === 'number' && df
      ? `A tangent line is drawn at ${xLabel} = ${tangentAt}, where the value is ${f(
          tangentAt,
        ).toFixed(1)} and the rate of change is ${df(tangentAt).toFixed(1)} per unit.`
      : '',
    limit ? `A horizontal threshold is marked at ${limit.y} (${limit.label}).` : '',
    markers.length > 0
      ? `Marked points: ${markers
          .map((m) => `${xLabel} = ${m.x}, value ${f(m.x).toFixed(1)}`)
          .join('; ')}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <figure style={{ margin: 0 }}>
      <svg className="graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        {/* grid */}
        {yTicks.map((y) => (
          <line key={`gy${y}`} className="graph-grid" x1={PAD.l} y1={sy(y)} x2={W - PAD.r} y2={sy(y)} />
        ))}
        {xTicks &&
          xTickValues.map((x) => (
            <line key={`gx${x}`} className="graph-grid" x1={sx(x)} y1={PAD.t} x2={sx(x)} y2={H - PAD.b} />
          ))}

        {/* threshold */}
        {limit && (
          <>
            <line className="graph-limit" x1={PAD.l} y1={sy(limit.y)} x2={W - PAD.r} y2={sy(limit.y)} />
            <text className="graph-label" x={W - PAD.r} y={sy(limit.y) - 6} textAnchor="end" fill="var(--red)">
              {limit.label}
            </text>
          </>
        )}

        {/* axes */}
        <line className="graph-axis" x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} />
        <line className="graph-axis" x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} />

        {xTicks &&
          xTickValues.map((x) => (
            <text key={`tx${x}`} className="graph-label" x={sx(x)} y={H - PAD.b + 15} textAnchor="middle">
              {x}
            </text>
          ))}
        {yTicks.map((y) => (
          <text key={`ty${y}`} className="graph-label" x={PAD.l - 7} y={sy(y) + 3.5} textAnchor="end">
            {Number.isInteger(y) ? y : y.toFixed(0)}
          </text>
        ))}

        <text className="graph-label" x={(W + PAD.l) / 2} y={H - 3} textAnchor="middle">
          {xLabel}
        </text>
        <text className="graph-label" x={11} y={(H - PAD.b + PAD.t) / 2} textAnchor="middle"
          transform={`rotate(-90 11 ${(H - PAD.b + PAD.t) / 2})`}>
          {yLabel}
        </text>

        {/* the model */}
        {showCurve && <path className="graph-curve" d={path} />}

        {/* the derivative, made visible */}
        {tangent && (
          <line className="graph-tangent" x1={tangent.x1} y1={tangent.y1} x2={tangent.x2} y2={tangent.y2} />
        )}

        {markers.map((m) => (
          <g key={`m${m.x}`}>
            <circle className="graph-point" cx={sx(m.x)} cy={sy(f(m.x))} r={5} />
            {m.label && (
              <text className="graph-label" x={sx(m.x)} y={sy(f(m.x)) - 12} textAnchor="middle" fill="var(--amber)">
                {m.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
};
