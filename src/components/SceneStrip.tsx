/**
 * The bottom strip of a scene: messages and the way forward, stacked.
 *
 * Both of those used to live at `bottom: 14px`, so they could only be shown
 * one at a time, and every stage wrote `{toast && <Toast/>}{!toast &&
 * <ProceedBar/>}`. That made a message HIDE the only control that leaves the
 * room, which is how the solver of stage 1 ended up stranded: the stage was
 * verified, two confirmations were queued on the strip, and the button behind
 * them was not reachable until both had expired. A pointer resting over a
 * toast pauses its countdown, so "until both expire" could be never.
 *
 * Stacking them removes the conflict at its source: the proceed bar has its
 * own row and is never conditional on there being no message. Nothing inside
 * the container swallows clicks on the artwork, so hotspots behind the empty
 * parts of the strip keep working.
 */

import type { ReactNode } from 'react';

export const SceneStrip = ({ children }: { children?: ReactNode }) => (
  <div className="scene-strip">{children}</div>
);
