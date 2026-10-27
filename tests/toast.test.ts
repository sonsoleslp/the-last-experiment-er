/**
 * Toast timing.
 *
 * The toast occupies the same strip as the proceed bar, so a confirmation
 * that lingers hides the next task. These assert the properties that matter
 * rather than exact magic numbers: confirmations are brief, consequences are
 * readable, and nothing outstays the cap.
 */

import { describe, expect, it } from 'vitest';
import { toastDuration } from '../src/components/Toast';

/** The longest body text any stage actually produces. */
const LONGEST_CONSEQUENCE = 226;
/** A typical success confirmation. */
const TYPICAL_SUCCESS = 112;

describe('toast duration', () => {
  it('clears a confirmation in a few seconds so the next task appears', () => {
    const ms = toastDuration('ok', TYPICAL_SUCCESS);
    expect(ms).toBeGreaterThanOrEqual(3000);
    expect(ms).toBeLessThanOrEqual(5000);
  });

  it('keeps consequences up long enough to read', () => {
    // Consequences explain why a decision failed; they are the most
    // instructive text in the game.
    expect(toastDuration('bad', LONGEST_CONSEQUENCE)).toBeGreaterThanOrEqual(9000);
    expect(toastDuration('warn', 131)).toBeGreaterThanOrEqual(7000);
  });

  it('always shows a consequence for longer than a confirmation', () => {
    for (const n of [20, 60, 120, 200, 400]) {
      expect(toastDuration('bad', n)).toBeGreaterThan(toastDuration('ok', n));
      expect(toastDuration('warn', n)).toBeGreaterThan(toastDuration('ok', n));
    }
  });

  it('scales with length, so longer explanations get more time', () => {
    expect(toastDuration('bad', 200)).toBeGreaterThan(toastDuration('bad', 50));
    expect(toastDuration('ok', 200)).toBeGreaterThan(toastDuration('ok', 50));
  });

  it('caps, so nothing can sit on the scene indefinitely', () => {
    const absurd = toastDuration('bad', 100000);
    expect(absurd).toBeLessThanOrEqual(12000);
    expect(toastDuration('ok', 100000)).toBeLessThanOrEqual(12000);
  });

  it('never returns a duration too short to notice', () => {
    for (const tone of ['ok', 'info', 'warn', 'bad'] as const) {
      expect(toastDuration(tone, 0)).toBeGreaterThanOrEqual(2500);
    }
  });
});
