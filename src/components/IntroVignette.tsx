/**
 * The visual behind each narration beat.
 *
 * Inline SVG rather than video frames: it scales to any window, costs nothing
 * to ship, and crossfades cleanly. Each vignette is a single strong image, not
 * an illustration of the words, since the captions carry the words.
 *
 * MOTION. Every beat moves, because a still picture under a voiceover reads as
 * a slideshow. Lights flicker in sequence, the failed pump coasts to a stop,
 * dust drifts through the corridor, the dead sensor panel tears and glitches,
 * the mission rings draw themselves in, and the whole frame pushes in slowly
 * under all of it.
 *
 * Nothing flashes faster than roughly once a second, which keeps it the right
 * side of the flash thresholds, and every animation element is omitted
 * entirely when the viewer has asked for reduced motion. SVG SMIL ignores the
 * CSS `prefers-reduced-motion` rule, so that has to be done here rather than
 * in the stylesheet.
 */

import type { ReactNode } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type VignetteBeat =
  | 'facility'
  | 'failure'
  | 'chamber'
  | 'sensor'
  | 'mission'
  | 'title';

const Frame = ({ children, push }: { children: ReactNode; push?: boolean }) => (
  <svg
    className={`vignette ${push ? 'vignette-push' : ''}`}
    viewBox="0 0 960 540"
    aria-hidden="true"
  >
    <rect width="960" height="540" fill="#04030c" />
    {children}
  </svg>
);

/** Red strobe bar. Slow enough to be atmosphere rather than a flash hazard. */
const Strobe = ({ y = 70, live }: { y?: number; live: boolean }) => (
  <>
    <rect x="0" y={y} width="960" height="5" fill="#2a0a1e" />
    {[120, 360, 600, 840].map((x, i) => (
      <circle key={x} cx={x} cy={y + 2} r="7" fill="#ff3860" opacity={live ? 0.15 : 0.7}>
        {live && (
          <animate
            attributeName="opacity"
            values="0.15;1;0.15"
            dur="2.2s"
            begin={`${i * 0.28}s`}
            repeatCount="indefinite"
          />
        )}
      </circle>
    ))}
  </>
);

/** Dust drifting through a light shaft. Cheap, and sells "abandoned". */
const Motes = ({ live, count = 14 }: { live: boolean; count?: number }) => {
  if (!live) return null;
  return (
    <g opacity="0.5">
      {Array.from({ length: count }, (_, i) => {
        const x = 90 + ((i * 137) % 780);
        const y = 120 + ((i * 263) % 300);
        const dur = 9 + (i % 5) * 2.5;
        const r = 1 + (i % 3) * 0.6;
        return (
          <circle key={i} cx={x} cy={y} r={r} fill="#9aa6cc">
            <animate
              attributeName="cy"
              values={`${y};${y - 60};${y}`}
              dur={`${dur}s`}
              begin={`${(i % 7) * 1.3}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.8;0"
              dur={`${dur}s`}
              begin={`${(i % 7) * 1.3}s`}
              repeatCount="indefinite"
            />
          </circle>
        );
      })}
    </g>
  );
};

export const IntroVignette = ({ beat, active }: { beat: VignetteBeat; active: boolean }) => {
  const reduced = useReducedMotion();
  /** Animate only while the intro is playing and motion is welcome. */
  const live = active && !reduced;

  /* ------------------------------------------------------------ corridor */

  if (beat === 'facility')
    return (
      <Frame push={live}>
        <path d="M0 0 L960 0 L960 540 L0 540 Z" fill="#070615" />
        <path d="M250 140 L710 140 L640 430 L320 430 Z" fill="#0b0820" stroke="#201a42" strokeWidth="2" />
        <path d="M0 0 L250 140 L320 430 L0 540 Z" fill="#0e0b24" />
        <path d="M960 0 L710 140 L640 430 L960 540 Z" fill="#0e0b24" />

        {/* Ceiling lights failing one after another down the corridor. */}
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect
              x={120 + i * 40}
              y={120 + i * 24}
              width="14"
              height={300 - i * 50}
              fill="#2ae6ff"
              opacity={live ? 0.1 : 0.4 - i * 0.07}
            >
              {live && (
                <animate
                  attributeName="opacity"
                  values="0.08;0.45;0.12;0.5;0.1"
                  dur={`${3.4 + i * 0.7}s`}
                  begin={`${i * 0.45}s`}
                  repeatCount="indefinite"
                />
              )}
            </rect>
            <rect
              x={806 - i * 40}
              y={120 + i * 24}
              width="14"
              height={300 - i * 50}
              fill="#2ae6ff"
              opacity={live ? 0.1 : 0.4 - i * 0.07}
            >
              {live && (
                <animate
                  attributeName="opacity"
                  values="0.1;0.4;0.08;0.46;0.12"
                  dur={`${3.9 + i * 0.6}s`}
                  begin={`${0.3 + i * 0.5}s`}
                  repeatCount="indefinite"
                />
              )}
            </rect>
          </g>
        ))}

        <Motes live={live} />

        {/* The floor sign, flickering as its ballast gives out. */}
        <rect x="430" y="250" width="100" height="36" rx="3" fill="#070615" stroke="#2e2a52" strokeWidth="2" />
        <text x="480" y="274" fontSize="17" fill="#2ae6ff" textAnchor="middle" fontFamily="monospace" letterSpacing="3">
          SL-3
          {live && (
            <animate attributeName="opacity" values="1;1;0.25;1;0.6;1" dur="5.5s" repeatCount="indefinite" />
          )}
        </text>
        <Strobe y={96} live={live} />
      </Frame>
    );

  /* ------------------------------------------------- the cooling failure */

  if (beat === 'failure')
    return (
      <Frame push={live}>
        <Strobe y={70} live={live} />

        <g stroke="#2c2656" strokeWidth="18" fill="none" strokeLinecap="round">
          <path d="M140 300 H420" />
          <path d="M540 300 H820 V180" />
        </g>

        {/* The last of the coolant draining out of the pipes. */}
        {live && (
          <>
            <path d="M140 300 H420" stroke="#2ae6ff" strokeWidth="7" strokeLinecap="round" opacity="0.7"
              strokeDasharray="10 14">
              <animate attributeName="stroke-dashoffset" values="0;-240" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0" dur="4s" fill="freeze" />
            </path>
            <path d="M540 300 H820 V180" stroke="#2ae6ff" strokeWidth="7" fill="none" strokeLinecap="round"
              opacity="0.7" strokeDasharray="10 14">
              <animate attributeName="stroke-dashoffset" values="0;-240" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0" dur="4s" fill="freeze" />
            </path>
          </>
        )}

        <circle cx="480" cy="300" r="62" fill="#0c0a1e" stroke="#991f3a" strokeWidth="4" />
        {/* The impeller coasting to a halt: fast, then slow, then stopped. */}
        <g>
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <line
              key={a}
              x1="480"
              y1="300"
              x2={480 + 46 * Math.cos((a * Math.PI) / 180)}
              y2={300 + 46 * Math.sin((a * Math.PI) / 180)}
              stroke="#453f72"
              strokeWidth="6"
              strokeLinecap="round"
            />
          ))}
          {live && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 480 300; 300 480 300; 430 480 300; 465 480 300; 472 480 300"
              keyTimes="0; 0.45; 0.72; 0.9; 1"
              dur="6s"
              fill="freeze"
            />
          )}
        </g>
        <circle cx="480" cy="300" r="9" fill="#1a1538" stroke="#453f72" strokeWidth="2" />

        <text x="480" y="412" fontSize="19" fill="#ff3860" textAnchor="middle" fontFamily="monospace" letterSpacing="4">
          LOOP B :: FAILED
          {live && (
            <animate attributeName="opacity" values="0;0;1;0.3;1" keyTimes="0;0.45;0.6;0.72;1" dur="6s" fill="freeze" />
          )}
        </text>

        {/* A single slow red wash, not a flash. */}
        {live && (
          <rect x="0" y="0" width="960" height="540" fill="#ff3860" opacity="0">
            <animate attributeName="opacity" values="0;0.13;0" dur="3.4s" repeatCount="indefinite" />
          </rect>
        )}
      </Frame>
    );

  /* ----------------------------------------------------------- chamber */

  if (beat === 'chamber')
    return (
      <Frame>
        {/*
          Slow push toward the glass. Scaling must be centred on the port or
          the frame drifts toward one corner, so it is wrapped in the usual
          translate / scale / translate-back sandwich rather than scaled about
          the SVG origin.
        */}
        <g transform="translate(480 280)">
          <g>
            {live && (
              <animateTransform
                attributeName="transform"
                type="scale"
                values="1;1.07"
                dur="13s"
                fill="freeze"
              />
            )}
            <g transform="translate(-480 -280)">
            <rect x="180" y="80" width="600" height="400" rx="16" fill="#0b0820" stroke="#403a70" strokeWidth="4" />
            <ellipse cx="480" cy="280" rx="190" ry="150" fill="#2a2340" stroke="#403a70" strokeWidth="6" />
            <ellipse cx="480" cy="280" rx="190" ry="150" fill="url(#introPortLight)" />
            <defs>
              <radialGradient id="introPortLight" cx="48%" cy="62%" r="62%">
                <stop offset="0%" stopColor="#ffb15c" stopOpacity="0.5" />
                <stop offset="55%" stopColor="#ff7a6e" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#ff5a7a" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Her silhouette, breathing. */}
            <g>
              {live && (
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0 0; 0 -4; 0 0"
                  dur="5.5s"
                  repeatCount="indefinite"
                />
              )}
              <path
                d="M455 268 C486 273, 507 299, 504 334 C526 328, 544 341, 552 355
                   C558 370, 550 392, 544 406 L449 406 C435 398, 432 364, 435 329
                   C437 297, 443 278, 455 268 Z"
                fill="#0a0916"
              />
              <circle cx="474" cy="242" r="27" fill="#0a0916" />
              <path d="M492 234 C508 236, 514 249, 511 258 C506 268, 492 268, 485 263 Z" fill="#dbe3f5" />
              <circle cx="506" cy="246" r="3.6" fill="#2bff9e">
                {live && (
                  <animate attributeName="opacity" values="0.3;1;0.3" dur="2.6s" repeatCount="indefinite" />
                )}
              </circle>
            </g>

            {/* Condensation creeping across the glass. */}
              <ellipse cx="370" cy="200" rx="52" ry="34" fill="#2ae6ff" opacity="0.05">
                {live && <animate attributeName="rx" values="40;62;40" dur="11s" repeatCount="indefinite" />}
              </ellipse>
            </g>
          </g>
        </g>

        <rect x="392" y="104" width="176" height="30" rx="3" fill="#070615" stroke="#2e2a52" strokeWidth="2" />
        <text x="480" y="125" fontSize="15" fill="#9aa6cc" textAnchor="middle" fontFamily="monospace" letterSpacing="4">
          CHAMBER C-7
        </text>
        <text x="480" y="508" fontSize="16" fill="#ffc53d" textAnchor="middle" fontFamily="monospace" letterSpacing="3">
          AIR 3.5 MIN
          {live && <animate attributeName="opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite" />}
        </text>
      </Frame>
    );

  /* ------------------------------------------------- the two instruments */

  if (beat === 'sensor')
    return (
      <Frame push={live}>
        {/* The healthy channel, quietly updating. */}
        <rect x="90" y="150" width="340" height="230" rx="8" fill="#070615" stroke="#3a3468" strokeWidth="4" />
        <rect x="106" y="166" width="308" height="198" fill="#04030f" />
        <text x="260" y="268" fontSize="62" fill="#2ae6ff" textAnchor="middle" fontFamily="monospace">
          18.0
          {live && <animate attributeName="opacity" values="1;0.82;1" dur="2.1s" repeatCount="indefinite" />}
        </text>
        <text x="260" y="310" fontSize="15" fill="#5f6792" textAnchor="middle" fontFamily="monospace">
          DEG C
        </text>

        {/* The dead channel, tearing and glitching. */}
        <rect x="530" y="150" width="340" height="230" rx="8" fill="#070615" stroke="#991f3a" strokeWidth="4" />
        <rect x="546" y="166" width="308" height="198" fill="#16041a" />
        <g>
          {live && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 0 0; 9 0; -6 0; 0 0; 0 0"
              keyTimes="0; 0.62; 0.68; 0.73; 0.79; 1"
              dur="3.6s"
              repeatCount="indefinite"
            />
          )}
          <text x="700" y="252" fontSize="22" fill="#ff3860" textAnchor="middle" fontFamily="monospace" letterSpacing="2">
            RATE SENSOR
          </text>
          <text x="700" y="292" fontSize="22" fill="#ff3860" textAnchor="middle" fontFamily="monospace" letterSpacing="2">
            FAULT
            {live && (
              <animate attributeName="opacity" values="1;1;0.2;1;0.5;1" dur="1.9s" repeatCount="indefinite" />
            )}
          </text>
        </g>
        <text x="700" y="336" fontSize="30" fill="#991f3a" textAnchor="middle" fontFamily="monospace">
          -- . --
        </text>
        {/* A scanline tear sweeping down the dead panel. */}
        {live && (
          <rect x="546" y="166" width="308" height="7" fill="#ff6e90" opacity="0.5">
            <animate attributeName="y" values="166;364;166" dur="4.2s" repeatCount="indefinite" />
          </rect>
        )}

        <text x="480" y="452" fontSize="15" fill="#9aa6cc" textAnchor="middle" fontFamily="monospace" letterSpacing="2">
          IT CAN MEASURE. IT CANNOT DECIDE.
          {live && <animate attributeName="opacity" values="0;1" dur="1.8s" begin="1s" fill="freeze" />}
        </text>
      </Frame>
    );

  /* ------------------------------------------------------- the mission */

  if (beat === 'mission')
    return (
      <Frame push={live}>
        <Strobe y={70} live={live} />
        {[
          { x: 160, label: 'RESTORE', sub: 'THE COOLANT' },
          { x: 480, label: 'FIND', sub: 'THE TREND' },
          { x: 800, label: 'OPEN', sub: 'THE DOOR' },
        ].map((c, i) => (
          <g key={c.label}>
            <circle cx={c.x} cy="260" r="76" fill="none" stroke="#2e2a52" strokeWidth="3" />
            <circle
              cx={c.x}
              cy="260"
              r="76"
              fill="none"
              stroke="#2ae6ff"
              strokeWidth="3"
              strokeDasharray="478"
              strokeDashoffset={live ? 478 : 0}
              transform={`rotate(-90 ${c.x} 260)`}
            >
              {live && (
                <animate
                  attributeName="stroke-dashoffset"
                  from="478"
                  to="0"
                  dur="1.1s"
                  begin={`${i * 0.55}s`}
                  fill="freeze"
                />
              )}
            </circle>
            <g opacity={live ? 0 : 1}>
              {live && (
                <animate attributeName="opacity" values="0;1" dur="0.5s" begin={`${0.5 + i * 0.55}s`} fill="freeze" />
              )}
              <text x={c.x} y="254" fontSize="22" fill="#e4ecff" textAnchor="middle" fontFamily="monospace" letterSpacing="2">
                {c.label}
              </text>
              <text x={c.x} y="280" fontSize="12" fill="#5f6792" textAnchor="middle" fontFamily="monospace" letterSpacing="2">
                {c.sub}
              </text>
              <text x={c.x} y="372" fontSize="13" fill="#1b8aa6" textAnchor="middle" fontFamily="monospace">
                0{i + 1}
              </text>
            </g>
          </g>
        ))}
        {/* A sweep line tying the three together. */}
        {live && (
          <line x1="84" y1="260" x2="84" y2="260" stroke="#2ae6ff" strokeWidth="2" opacity="0.35">
            <animate attributeName="x2" values="84;876" dur="2.2s" begin="0.2s" fill="freeze" />
          </line>
        )}
      </Frame>
    );

  /* --------------------------------------------------------- title card */

  return (
    <Frame>
      <g>
        {live && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 0; 5 0; -3 0; 0 0; 0 0"
            keyTimes="0; 0.78; 0.83; 0.87; 0.92; 1"
            dur="5.5s"
            repeatCount="indefinite"
          />
        )}
        {/* Chromatic split, drawn as three offset copies. */}
        {[
          { dx: -3, fill: '#2ae6ff', op: 0.55 },
          { dx: 3, fill: '#ff2e88', op: 0.55 },
          { dx: 0, fill: '#e4ecff', op: 1 },
        ].map((layer) => (
          <g key={layer.dx} opacity={layer.op}>
            <text x={480 + layer.dx} y="252" fontSize="52" fill={layer.fill} textAnchor="middle" fontFamily="monospace" letterSpacing="6">
              THE LAST
            </text>
            <text x={480 + layer.dx} y="312" fontSize="52" fill={layer.fill} textAnchor="middle" fontFamily="monospace" letterSpacing="6">
              EXPERIMENT
            </text>
          </g>
        ))}
      </g>
      <text x="480" y="372" fontSize="20" fill="#ff2e88" textAnchor="middle" fontFamily="monospace" letterSpacing="8">
        CONTAINMENT FAILURE
        {live && <animate attributeName="opacity" values="0;1" dur="1.4s" begin="0.6s" fill="freeze" />}
      </text>
      <Strobe y={430} live={live} />
    </Frame>
  );
};
