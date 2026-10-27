/**
 * Dr Vale, seen through the observation port of chamber C-7.
 *
 * Drawn as a BACKLIT SILHOUETTE, deliberately. Earlier versions drew her as
 * several separately stroked shapes in mid-violet tones on dark glass, which
 * failed twice: the tones were too close together to read at all, and
 * individually outlined limbs show their seams and look like a pile of blobs
 * instead of a person.
 *
 * A silhouette removes both failure modes. The port is lit from inside the
 * chamber, the body is one closed path with no stroke and no internal detail,
 * and the only highlights are the emergency mask and its hose, which is
 * genuinely what you would pick out against a bright window. There is no
 * anatomy to render wrong because there is no anatomy drawn.
 *
 * ARTWORK OVERRIDE: if `public/media/vale.png` exists it is drawn inside the
 * port instead, clipped to the glass. Same graceful-fallback pattern as the
 * intro narration: drop the file in and it is used, remove it and the
 * silhouette returns. Nothing in the code needs changing.
 */

import { useEffect, useState } from 'react';
import { assetUrl } from '../game/intro';

const ART_SRC = assetUrl('media/vale.png');

/** True once an optional image is confirmed to load. Never throws. */
const useOptionalImage = (src: string): boolean => {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (live) setOk(true);
    };
    img.onerror = () => {
      /* no artwork supplied; the silhouette stands */
    };
    img.src = src;
    return () => {
      live = false;
    };
  }, [src]);
  return ok;
};

export const ValeFigure = ({ released }: { released: boolean }) => {
  const hasArt = useOptionalImage(ART_SRC);

  return (
    <>
      <defs>
        {/* Emergency lighting inside the chamber, brightest behind her. */}
        <radialGradient id="portLight" cx="48%" cy="62%" r="62%">
          <stop offset="0%" stopColor={released ? '#4effc0' : '#ffb15c'} stopOpacity="0.55" />
          <stop offset="45%" stopColor={released ? '#2bd89a' : '#ff7a6e'} stopOpacity="0.26" />
          <stop offset="100%" stopColor="#ff5a7a" stopOpacity="0" />
        </radialGradient>
        <clipPath id="portClip">
          <ellipse cx="480" cy="250" rx="110" ry="80" />
        </clipPath>
      </defs>

      <g clipPath="url(#portClip)">
        {hasArt ? (
          <image href={ART_SRC} x="370" y="170" width="220" height="160" preserveAspectRatio="xMidYMax slice" />
        ) : (
          <g opacity={released ? 0.82 : 1}>
            {/* Slow breathing: movement, not a fade. */}
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 0 -2; 0 0"
              dur="5.5s"
              repeatCount="indefinite"
            />

            {/*
              One closed path: the back, the shoulder, the chest, the forearm
              resting on a raised knee, the shin, and the floor. No stroke, so
              no seams.
            */}
            <path
              d="M455 231
                 C474 234, 487 250, 485 272
                 C499 268, 510 276, 515 285
                 C519 294, 514 308, 510 317
                 L451 317
                 C442 312, 440 291, 442 269
                 C443 249, 447 237, 455 231 Z"
              fill={released ? '#1a1a2e' : '#0a0916'}
            />
            {/* Head, same fill so it merges into the shoulder with no seam. */}
            <circle cx="467" cy="214" r="17" fill={released ? '#1a1a2e' : '#0a0916'} />

            {!released && (
              <>
                {/* The mask, in profile against the lit glass. */}
                <path
                  d="M478 209 C488 210, 492 218, 490 224 C487 230, 478 230, 474 227 Z"
                  fill="#dbe3f5"
                />
                {/* supply hose, down to the cartridge in her lap */}
                <path
                  d="M487 228 C492 240, 487 252, 478 258"
                  fill="none"
                  stroke="#aab4cf"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                {/* life-support indicator */}
                <circle cx="486" cy="217" r="2.4" fill="#2bff9e">
                  <animate attributeName="opacity" values="0.3;1;0.3" dur="2.6s" repeatCount="indefinite" />
                </circle>
              </>
            )}
          </g>
        )}

        {/* Her handprint on the inside of the glass. */}
        {!released && (
          <g opacity="0.3">
            <ellipse cx="536" cy="223" rx="11" ry="14" fill="#cfe8ff" />
            {[-13, -5, 3, 11].map((dx, i) => (
              <ellipse
                key={dx}
                cx={536 + dx}
                cy={206 - Math.abs(dx) * 0.22 + (i === 0 ? 6 : 0)}
                rx="3.2"
                ry={i === 0 ? 5 : 7}
                fill="#cfe8ff"
              />
            ))}
          </g>
        )}
      </g>
    </>
  );
};
