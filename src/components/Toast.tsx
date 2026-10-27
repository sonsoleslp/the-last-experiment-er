/**
 * In-scene feedback. Consequences and warnings appear over the bottom of the
 * scene rather than growing the page downward.
 *
 * These dismiss themselves. A confirmation that lingered; "COOLING
 * MAINTAINED: TRANSIENT STABLE": sat over the next thing the team needed to
 * see until someone thought to close it. Now it clears itself.
 *
 * It no longer HIDES anything while it is up: the message and the proceed
 * control have separate rows in components/SceneStrip.tsx. They used to share
 * one, which is why the countdown matters less than it did and why the pause
 * below is capped rather than indefinite.
 *
 * Timing is by tone, because the messages do different jobs: a success
 * confirmation only needs acknowledging, while a consequence explains why a
 * decision was wrong and has to be readable. Long bodies get proportionally
 * longer, capped so nothing outstays its welcome.
 *
 * Auto-dismissing content is an accessibility hazard, so three mitigations:
 * the countdown pauses while the pointer is over the toast or anything inside
 * it has focus, the manual close is still there, and a progress line makes the
 * remaining time visible instead of surprising. Nothing here is the only
 * channel for its information: every consequence is also reflected in the
 * scene, the HUD and the instruments.
 */

import { useEffect, useRef, useState } from 'react';
import { sfx } from '../audio/engine';
import type { Tone } from './ui';

const GLYPH: Record<Tone, string> = { ok: '✓', warn: '!', bad: '✕', info: 'i' };
const WORD: Record<Tone, string> = { ok: 'Success', warn: 'Caution', bad: 'Alert', info: 'Information' };
const TONE_SFX: Record<Tone, 'accept' | 'reject' | 'warn' | 'click'> = {
  ok: 'accept',
  bad: 'reject',
  warn: 'warn',
  info: 'click',
};

/*
 * Base visible time per tone, ms.
 *
 * Confirmations are short: they sit on the strip where the proceed bar
 * appears, so every extra second is a second the next task is hidden. Nobody
 * needs to study "COOLANT FLOW ESTABLISHED": they need to get on with it.
 * Consequences are much longer because they explain why a decision failed and
 * are the most instructive text in the game.
 */
const BASE: Record<Tone, number> = { ok: 2600, info: 2600, warn: 6500, bad: 7000 };
/** Extra reading time per character of body text, ms. */
const PER_CHAR = 16;
const MAX_MS = 12000;
const TICK = 100;
/*
 * How long the hover/focus pause may hold a message open, ms.
 *
 * The pause exists so a message cannot vanish while it is being read. But a
 * message sits on the same strip as the proceed control, and a pointer coming
 * to rest there, which is exactly where a pointer comes to rest, held the
 * countdown indefinitely. Capping it keeps the courtesy and removes the
 * deadlock: the manual close is still there, and nothing here is the only
 * channel for its information.
 */
const MAX_PAUSE_MS = 15000;

export interface ToastData {
  tone: Tone;
  title: string;
  body: string;
}

/**
 * How long a message stays on screen.
 *
 * Confirmations clear quickly so the next task is revealed; consequences stay
 * long enough to read, scaled by length and capped.
 */
export const toastDuration = (tone: Tone, bodyLength: number): number =>
  Math.min(MAX_MS, BASE[tone] + bodyLength * PER_CHAR);

export const Toast = ({ data, onClose }: { data: ToastData; onClose: () => void }) => {
  const total = toastDuration(data.tone, data.body.length);
  const [remaining, setRemaining] = useState(total);
  const paused = useRef(false);
  const pausedFor = useRef(0);
  const closed = useRef(false);
  /*
   * Read onClose through a ref for the same reason the modal does: callers
   * pass an inline arrow, so depending on it restarted the countdown every
   * time the parent re-rendered. A player typing in a console field reset the
   * timer on every keystroke and the message never cleared.
   */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // One cue per message, keyed on the text so a repeated message re-sounds.
  useEffect(() => {
    sfx(TONE_SFX[data.tone]);
  }, [data.tone, data.title]);

  useEffect(() => {
    closed.current = false;
    pausedFor.current = 0;
    setRemaining(total);
    /*
     * The countdown is kept in a local, NOT read back out of state inside an
     * updater. onClose used to be called from within the setRemaining updater,
     * and React runs updaters during render: dismissing the message therefore
     * set state on the parent mid-render ("Cannot update a component while
     * rendering a different component"), which React is free to discard. For
     * the shared team notification the parent's handler is what moves the
     * player on, so losing it left them watching a message disappear and
     * nothing happen.
     */
    let left = total;
    const id = window.setInterval(() => {
      if (paused.current && pausedFor.current < MAX_PAUSE_MS) {
        pausedFor.current += TICK;
        return;
      }
      left = Math.max(0, left - TICK);
      setRemaining(left);
      if (left === 0 && !closed.current) {
        closed.current = true;
        window.clearInterval(id);
        onCloseRef.current();
      }
    }, TICK);
    return () => window.clearInterval(id);
    // Restart the countdown only when the message itself changes.
  }, [data.title, data.body, total]);

  const hold = () => {
    paused.current = true;
  };
  const release = () => {
    paused.current = false;
  };

  return (
    <div
      className="toast"
      data-tone={data.tone}
      role={data.tone === 'bad' ? 'alert' : 'status'}
      onMouseEnter={hold}
      onMouseLeave={release}
      onFocusCapture={hold}
      onBlurCapture={release}
    >
      <span className="alert-icon" aria-hidden="true">
        {GLYPH[data.tone]}
      </span>
      <div className="toast-body">
        <b>
          <span className="sr-only">{WORD[data.tone]}: </span>
          {data.title}
        </b>
        <p>{data.body}</p>
      </div>
      <button className="toast-close" onClick={onClose} aria-label="Dismiss message">
        ✕
      </button>
      <span
        className="toast-timer"
        aria-hidden="true"
        style={{ width: `${(remaining / total) * 100}%` }}
      />
    </div>
  );
};
