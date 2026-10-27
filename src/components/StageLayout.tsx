/**
 * The frame every stage renders into.
 *
 * NOTE: there is no hint affordance here. Hints are configured in Escapp and
 * requested through Escapp's own interface, which is where its hint allowance,
 * scoring and monitoring live. The client library exposes no hint API, so an
 * in-app hint panel could only ever be a second, untracked hint system running
 * alongside the real one. See docs/ESCAPP_HINTS.md for the text to paste in.
 *
 * Design rule: the scene IS the page. There is no scrolling and nothing is
 * stacked below the artwork. A single HUD line carries where you are, what you
 * are trying to do and the live instrument values that matter; everything
 * else; equipment, documents, consoles: opens over the scene when the player
 * clicks it. That keeps the whole game inside one viewport on a school laptop
 * and makes it read as a room rather than a web page.
 */

import type { ReactNode } from 'react';
import { Hotspot, type HotspotDef } from './Hotspot';

export interface HudStat {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad';
}

export const StageLayout = ({
  stage,
  objective,
  stats = [],
  scene,
  hotspots,
  seen,
  onHotspot,
  children,
}: {
  stage: number;
  /** One short line. If it needs two, it belongs in a document. */
  objective: string;
  stats?: HudStat[];
  scene: ReactNode;
  hotspots: HotspotDef[];
  seen: string[];
  onHotspot: (id: string) => void;
  /** Overlays: consoles, toasts, the proceed strip. */
  children?: ReactNode;
}) => (
  <>
    <div className="hud">
      <span className="hud-stage">STAGE {stage}</span>
      <span className="hud-objective">{objective}</span>
      {stats.map((s) => (
        <span key={s.label} className="hud-stat" data-tone={s.tone}>
          <span>{s.label}</span>
          <b>{s.value}</b>
        </span>
      ))}
    </div>

    <div className="scene">
      <div className="scene-frame">
        {scene}
        {hotspots.map((h) => (
          <Hotspot key={h.id} def={h} seen={seen.includes(h.id)} onActivate={() => onHotspot(h.id)} />
        ))}
        {children}
      </div>
    </div>
  </>
);
