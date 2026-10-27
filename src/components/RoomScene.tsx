/**
 * The laboratory environments, drawn as inline SVG.
 *
 * SVG rather than bitmaps: it scales to any laptop screen, stays crisp, and
 * lets equipment react to game state (lights change, pumps spin, doors open)
 * without an asset pipeline. Each scene is purely decorative; the interactive
 * objects are <Hotspot> buttons layered on top, so nothing in the scene itself
 * needs to be reachable.
 */

import type { ReactNode } from 'react';

import { ValeFigure } from './ValeFigure';

const Wall = ({ tone = '#100d26' }: { tone?: string }) => (
  <>
    <rect x="0" y="0" width="960" height="540" fill="#04030c" />
    <rect x="0" y="0" width="960" height="430" fill={tone} />
    {/* floor */}
    <path d="M0 430 L960 430 L960 540 L0 540 Z" fill="#070615" />
    <path d="M0 430 L960 430 L870 540 L90 540 Z" fill="#0e0b24" opacity="0.7" />
    {/* wall panel seams */}
    {[160, 320, 480, 640, 800].map((x) => (
      <line key={x} x1={x} y1="0" x2={x} y2="430" stroke="#1a1538" strokeWidth="2" />
    ))}
    <line x1="0" y1="96" x2="960" y2="96" stroke="#1a1538" strokeWidth="2" />
    <line x1="0" y1="430" x2="960" y2="430" stroke="#2a2352" strokeWidth="3" />
  </>
);

/** Red strobe bar used in every room while the emergency is live. */
const EmergencyStrip = () => (
  <>
    <rect x="0" y="86" width="960" height="7" fill="#2a0a1e" />
    {[80, 300, 520, 740].map((x, i) => (
      <circle key={x} cx={x} cy="89" r="9" fill="#ff3860" opacity="0.85">
        <animate
          attributeName="opacity"
          values="0.2;0.95;0.2"
          dur="2.4s"
          begin={`${i * 0.3}s`}
          repeatCount="indefinite"
        />
      </circle>
    ))}
  </>
);

export const SceneFrame = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 960 540" aria-hidden="true">
    {children}
  </svg>
);

/* ------------------------------------------------------ STAGE 1: the lab -- */

export const LabScene = ({ doorOpen, cabinetOpen }: { doorOpen: boolean; cabinetOpen: boolean }) => (
  <SceneFrame>
    <Wall />
    <EmergencyStrip />

    {/* wall clock */}
    <circle cx="150" cy="170" r="34" fill="#0b0820" stroke="#2e2a52" strokeWidth="3" />
    <circle cx="150" cy="170" r="27" fill="#141b27" />
    <line x1="150" y1="170" x2="150" y2="152" stroke="#9aa6cc" strokeWidth="3" />
    <line x1="150" y1="170" x2="164" y2="178" stroke="#9aa6cc" strokeWidth="2.5" />
    <circle cx="150" cy="170" r="2.5" fill="#2ae6ff" />

    {/* laboratory map on the wall */}
    <rect x="236" y="130" width="112" height="84" fill="#0d0a20" stroke="#2e2a52" strokeWidth="2" />
    <rect x="244" y="140" width="40" height="28" fill="#191238" stroke="#443d74" />
    <rect x="290" y="140" width="50" height="28" fill="#191238" stroke="#443d74" />
    <rect x="244" y="176" width="96" height="30" fill="#230d1e" stroke="#991f3a" />
    <text x="292" y="196" fontSize="11" fill="#ff6e90" textAnchor="middle" fontFamily="monospace">C-7</text>

    {/* filing cabinet */}
    <rect x="404" y="214" width="104" height="216" fill="#1a1538" stroke="#35305c" strokeWidth="2" />
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <rect x="412" y={226 + i * 68} width="88" height="56" fill="#120f2a" stroke="#2e2a52" />
        <rect x="444" y={250 + i * 68} width="24" height="5" rx="2" fill="#564e8c" />
      </g>
    ))}
    {/* keypad on the cabinet */}
    <rect x="456" y="195" width="46" height="15" rx="2" fill="#070615" stroke="#2e2a52" />
    <circle cx="464" cy="202" r="3" fill={cabinetOpen ? '#2bff9e' : '#ffc53d'} />
    <text x="472" y="206" fontSize="8" fill="#9aa6cc" fontFamily="monospace">LOCK</text>

    {/* desk */}
    <rect x="540" y="300" width="250" height="18" rx="3" fill="#2a2352" stroke="#403a70" strokeWidth="2" />
    <rect x="552" y="318" width="86" height="112" fill="#1a1538" stroke="#35305c" strokeWidth="2" />
    <rect x="560" y="330" width="70" height="26" fill="#120f2a" stroke="#2e2a52" />
    <rect x="585" y="340" width="20" height="4" rx="2" fill="#564e8c" />
    <rect x="560" y="364" width="70" height="26" fill="#120f2a" stroke="#2e2a52" />
    <rect x="585" y="374" width="20" height="4" rx="2" fill="#564e8c" />
    <rect x="762" y="318" width="20" height="112" fill="#1a1538" stroke="#35305c" strokeWidth="2" />

    {/* computer on the desk */}
    <rect x="648" y="214" width="128" height="86" rx="4" fill="#070615" stroke="#3a3468" strokeWidth="3" />
    <rect x="656" y="222" width="112" height="70" fill="#02100a" />
    {[0, 1, 2, 3, 4].map((i) => (
      <rect key={i} x="664" y={232 + i * 12} width={i % 2 ? 72 : 92} height="4" fill="#17a06a" opacity="0.8">
        <animate attributeName="opacity" values="0.35;0.9;0.35" dur="3s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
      </rect>
    ))}
    <rect x="690" y="300" width="44" height="10" fill="#1a1538" />
    <rect x="672" y="310" width="80" height="6" rx="2" fill="#2a2352" />

    {/* notebook on the desk */}
    <rect x="556" y="286" width="62" height="16" rx="2" fill="#6b4a6a" stroke="#8a5a86" strokeWidth="1.5" />
    <rect x="560" y="289" width="54" height="3" fill="#d8cfe8" opacity="0.7" />

    {/* door to the cooling room */}
    <rect x="836" y="150" width="104" height="280" fill="#070615" stroke="#3a3468" strokeWidth="3" />
    {doorOpen ? (
      <>
        <rect x="844" y="158" width="88" height="264" fill="#04211c" />
        <rect x="844" y="158" width="88" height="264" fill="url(#doorGlow)" />
        <defs>
          <linearGradient id="doorGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2ae6ff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#2ae6ff" stopOpacity="0.03" />
          </linearGradient>
        </defs>
      </>
    ) : (
      <>
        <rect x="844" y="158" width="88" height="264" fill="#140f2e" />
        <line x1="888" y1="158" x2="888" y2="422" stroke="#070615" strokeWidth="4" />
        <rect x="856" y="268" width="64" height="30" rx="3" fill="#230d1e" stroke="#991f3a" strokeWidth="2" />
        <text x="888" y="288" fontSize="13" fill="#ff3860" textAnchor="middle" fontFamily="monospace">SEALED</text>
      </>
    )}
    {/* card reader */}
    <rect x="812" y="268" width="16" height="34" rx="3" fill="#070615" stroke="#2e2a52" strokeWidth="2" />
    <circle cx="820" cy="278" r="4" fill={doorOpen ? '#2bff9e' : '#ff3860'} />
  </SceneFrame>
);

/* -------------------------------------------- STAGE 2: the cooling plant -- */

export const CoolingScene = ({ running, flow }: { running: boolean; flow: number }) => (
  <SceneFrame>
    <Wall tone="#0e0b22" />
    <EmergencyStrip />

    {/* coolant tank */}
    <rect x="60" y="150" width="130" height="280" rx="10" fill="#13102c" stroke="#363061" strokeWidth="3" />
    <rect x="72" y="250" width="106" height="170" rx="6" fill="#10263f" opacity="0.9" />
    <rect x="72" y="250" width="106" height="8" fill="#2ae6ff" opacity="0.5" />
    <text x="125" y="196" fontSize="12" fill="#5f6792" textAnchor="middle" fontFamily="monospace">COOLANT</text>
    <text x="125" y="214" fontSize="12" fill="#5f6792" textAnchor="middle" fontFamily="monospace">RESERVOIR</text>

    {/* pipe run, tank -> pump -> chamber riser */}
    <path d="M190 330 H330" stroke="#2c2656" strokeWidth="22" strokeLinecap="round" />
    <path d="M470 330 H760 V190" stroke="#2c2656" strokeWidth="22" strokeLinecap="round" fill="none" />
    {running && (
      <>
        <path className="pipe-flow" d="M190 330 H330" stroke="#2ae6ff" strokeWidth="9" strokeLinecap="round"
          style={{ animationDuration: `${Math.max(0.35, 2.2 - flow / 14)}s` }} />
        <path className="pipe-flow" d="M470 330 H760 V190" stroke="#2ae6ff" strokeWidth="9" fill="none" strokeLinecap="round"
          style={{ animationDuration: `${Math.max(0.35, 2.2 - flow / 14)}s` }} />
      </>
    )}

    {/* the pump */}
    <rect x="330" y="258" width="140" height="144" rx="8" fill="#1a1538" stroke="#403a70" strokeWidth="3" />
    <circle cx="400" cy="330" r="46" fill="#0c0a1e" stroke="#35305c" strokeWidth="3" />
    <g>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <line key={a} x1="400" y1="330"
          x2={400 + 36 * Math.cos((a * Math.PI) / 180)}
          y2={330 + 36 * Math.sin((a * Math.PI) / 180)}
          stroke={running ? '#2ae6ff' : '#453f72'} strokeWidth="5" strokeLinecap="round" />
      ))}
      {running && (
        <animateTransform attributeName="transform" type="rotate"
          from="0 400 330" to="360 400 330"
          dur={`${Math.max(0.25, 2.6 - flow / 11)}s`} repeatCount="indefinite" />
      )}
    </g>
    <circle cx="400" cy="330" r="7" fill="#2a2352" stroke="#564e8c" strokeWidth="2" />
    {/* Status plate. Sized to the label: "PMP-B" at 8px monospace is ~25px
        wide, so the plate needs ~50px to hold the LED and the text. */}
    <rect x="344" y="267" width="50" height="14" rx="2" fill="#070615" stroke="#2e2a52" />
    <circle cx="352" cy="274" r="3.5" fill={running ? '#2bff9e' : '#ff3860'} />
    <text x="359" y="277" fontSize="8" fill="#9aa6cc" fontFamily="monospace">PMP-B</text>

    {/* regulator housing beside the pump */}
    <rect x="330" y="412" width="140" height="18" rx="3" fill="#2a2352" stroke="#403a70" strokeWidth="2" />

    {/* flow meter on the riser */}
    <rect x="700" y="196" width="120" height="78" rx="6" fill="#070615" stroke="#3a3468" strokeWidth="3" />
    <rect x="708" y="204" width="104" height="62" fill="#04030f" />
    <text x="760" y="232" fontSize="24" fill={running ? '#2ae6ff' : '#453f72'} textAnchor="middle" fontFamily="monospace">
      {running ? flow.toFixed(0) : '--'}
    </text>
    <text x="760" y="252" fontSize="10" fill="#5f6792" textAnchor="middle" fontFamily="monospace">L/MIN</text>

    {/* engineering binder on a shelf */}
    <rect x="540" y="414" width="86" height="16" rx="2" fill="#2a2352" stroke="#403a70" strokeWidth="2" />
    <rect x="548" y="392" width="24" height="22" fill="#5a3a6b" stroke="#7a4a8a" strokeWidth="1.5" />
    <rect x="576" y="392" width="24" height="22" fill="#3a4a7a" stroke="#4a5f9a" strokeWidth="1.5" />
  </SceneFrame>
);

/* ------------------------------------------ STAGE 3: thermal monitoring -- */

export const ThermalScene = ({ stabilised }: { stabilised: boolean }) => (
  <SceneFrame>
    <Wall tone="#0d0a20" />
    <EmergencyStrip />

    {/* bank of monitors */}
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <rect x={110 + i * 250} y="150" width="210" height="140" rx="6" fill="#070615" stroke="#3a3468" strokeWidth="3" />
        <rect x={120 + i * 250} y="160" width="190" height="120" fill="#04030f" />
      </g>
    ))}

    {/* monitor 1: big temperature readout */}
    <text x="215" y="226" fontSize="40" fill="#2ae6ff" textAnchor="middle" fontFamily="monospace">18.0</text>
    <text x="215" y="252" fontSize="12" fill="#5f6792" textAnchor="middle" fontFamily="monospace">DEG C / C-7</text>

    {/* monitor 2: the broken trend sensor */}
    <text x="465" y="206" fontSize="13" fill="#ff3860" textAnchor="middle" fontFamily="monospace">TREND SENSOR</text>
    <text x="465" y="230" fontSize="13" fill="#ff3860" textAnchor="middle" fontFamily="monospace">FAULT</text>
    <text x="465" y="258" fontSize="22" fill="#991f3a" textAnchor="middle" fontFamily="monospace">-- . --</text>

    {/* monitor 3: status */}
    <text x="715" y="206" fontSize="12" fill={stabilised ? '#2bff9e' : '#ffc53d'} textAnchor="middle" fontFamily="monospace">
      {stabilised ? 'COOLING NOMINAL' : 'AWAITING'}
    </text>
    <text x="715" y="228" fontSize="12" fill={stabilised ? '#2bff9e' : '#ffc53d'} textAnchor="middle" fontFamily="monospace">
      {stabilised ? 'TRANSIENT STABLE' : 'INTERVENTION'}
    </text>
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={636 + i * 40} y="246" width="28" height="7"
        fill={stabilised ? '#2bff9e' : '#453f72'} opacity={stabilised ? 0.9 : 0.5} />
    ))}

    {/* console desk */}
    <rect x="80" y="316" width="800" height="22" rx="4" fill="#2a2352" stroke="#403a70" strokeWidth="2" />
    <rect x="80" y="338" width="800" height="92" fill="#140f2e" stroke="#2e2a52" strokeWidth="2" />
    {/* protocol binder resting on the console */}
    <rect x="150" y="292" width="30" height="24" fill="#6b2a4a" stroke="#8a3a60" strokeWidth="1.5" />
    {/* rows of indicator lights */}
    {Array.from({ length: 16 }, (_, i) => (
      <circle key={i} cx={130 + i * 46} cy="372" r="5"
        fill={i % 3 === 0 ? '#ffc53d' : '#2e2a52'} opacity={i % 3 === 0 ? 0.85 : 1} />
    ))}
  </SceneFrame>
);

/* --------------------------------------------- STAGE 4/5: chamber C-7 ---- */

export const ChamberScene = ({
  released,
  armed,
}: {
  released: boolean;
  armed: boolean;
}) => (
  <SceneFrame>
    <Wall tone="#0c0920" />
    <EmergencyStrip />

    {/* the chamber bulkhead */}
    <rect x="280" y="120" width="400" height="310" rx="14" fill="#131029" stroke="#403a70" strokeWidth="4" />
    <rect x="300" y="140" width="360" height="270" rx="8" fill="#070615" stroke="#2e2a52" strokeWidth="2" />

    {/* observation window */}
    <ellipse cx="480" cy="250" rx="118" ry="88" fill={released ? '#0a2a28' : '#0f1b3a'} stroke="#403a70" strokeWidth="5" />
    {/*
      The glass is LIT, not dark. A silhouette needs something bright behind
      it; the earlier near-black glass is why every attempt at drawing her
      disappeared into the background. ValeFigure paints the actual light
      gradient (portLight) over this base.
    */}
    <ellipse cx="480" cy="250" rx="110" ry="80" fill={released ? '#123f36' : '#2a2340'} />
    {/* Condensation, kept to the edges so it never sits over the figure. */}
    <ellipse cx="406" cy="208" rx="28" ry="19" fill="#2ae6ff" opacity="0.06" />
    <ellipse cx="556" cy="296" rx="24" ry="15" fill="#2ae6ff" opacity="0.05" />

    {/*
      Dr Vale, as a backlit silhouette.

      Two earlier attempts drew her as separate stroked shapes in mid tones on
      dark glass. That was the wrong approach twice over: the tones were too
      close to read, and separately outlined body parts show their seams and
      look like overlapping blobs rather than a person.

      A silhouette is far more robust. The port is lit brightly from inside the
      chamber, she is near-black against it, and the whole figure is ONE closed
      path with no stroke, so there are no seams to go wrong. Only the mask and
      the hose are picked out, in light grey, because in silhouette that is
      what you would actually see.

      If you would rather supply artwork, drop an image at
      public/media/vale.png and it is used inside the port instead of this
      drawing. See ValeFigure.
    */}
    <ValeFigure released={released} />
    {/* chamber label */}
    <rect x="404" y="150" width="152" height="26" rx="3" fill="#070615" stroke="#2e2a52" strokeWidth="2" />
    <text x="480" y="168" fontSize="13" fill="#9aa6cc" textAnchor="middle" fontFamily="monospace" letterSpacing="3">
      CHAMBER C-7
    </text>

    {/* the door seal, visibly retracted on release */}
    <rect x={released ? 236 : 296} y="356" width="64" height="54" rx="3" fill="#201a42" stroke="#403a70" strokeWidth="2"
      style={{ transition: 'x 1.4s cubic-bezier(.3,.1,.3,1)' }} />
    <rect x={released ? 660 : 600} y="356" width="64" height="54" rx="3" fill="#201a42" stroke="#403a70" strokeWidth="2"
      style={{ transition: 'x 1.4s cubic-bezier(.3,.1,.3,1)' }} />
    <text x="480" y="390" fontSize="12" fill={released ? '#2bff9e' : '#ff3860'} textAnchor="middle" fontFamily="monospace">
      {released ? 'SEAL RETRACTED' : 'SEAL ENGAGED'}
    </text>

    {/* status stack, left */}
    <rect x="60" y="180" width="170" height="190" rx="6" fill="#070615" stroke="#3a3468" strokeWidth="3" />
    {['POWER', 'COOLANT', 'INTERLOCK', 'RELEASE'].map((label, i) => (
      <g key={label}>
        <circle cx="90" cy={214 + i * 44} r="8"
          fill={i < 2 ? '#2bff9e' : i === 2 && armed ? '#ffc53d' : released ? '#2bff9e' : '#453f72'} />
        <text x="110" y={219 + i * 44} fontSize="11" fill="#9aa6cc" fontFamily="monospace">{label}</text>
      </g>
    ))}

    {/* alarm horn, right: silent once released */}
    <path d="M760 220 L810 196 L810 284 L760 260 Z" fill="#201a42" stroke="#403a70" strokeWidth="2" />
    {!released && (
      <>
        <circle cx="836" cy="240" r="14" fill="none" stroke="#ff3860" strokeWidth="2" opacity="0.6">
          <animate attributeName="r" values="14;30;14" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="836" cy="240" r="22" fill="none" stroke="#ff3860" strokeWidth="2" opacity="0.35">
          <animate attributeName="r" values="22;44;22" dur="2s" begin="0.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.35;0;0.35" dur="2s" begin="0.5s" repeatCount="indefinite" />
        </circle>
      </>
    )}
  </SceneFrame>
);
