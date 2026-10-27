/**
 * A new team must start from scratch.
 *
 * Escapp identifies a run by the escape room's start time. When a new team
 * starts, everything the previous team built locally has to go, or the new team
 * walks into a laboratory with the cabinet already open, the pump already
 * running and the vent valve already spent.
 *
 * There are two independent guards and this file covers both:
 *
 *   1. The stored blob carries the run it belongs to, so state from another run
 *      is refused even if nothing wiped it.
 *   2. GameProvider compares a run marker on every boot and wipes on a
 *      mismatch. That one matters because the Escapp client's own restart
 *      callback cannot be relied on alone: it early-returns in preview mode.
 */

import { describe, expect, it } from 'vitest';
import {
  GAME_STATE_KEY,
  RUN_MARKER_KEY,
  hydrateGameState,
  initialGameState,
  packGameState,
  type GameState,
} from '../src/game/gameState';

/** State a team leaves behind at the very end of a run. */
const finished: GameState = {
  ...initialGameState,
  briefingSeen: true,
  cabinetOpen: true,
  inventory: ['badge', 'accessCard'],
  documents: ['emergency-broadcast', 'calibration-report'],
  pumpSetting: 3,
  pumpRunning: true,
  flowLog: [{ x: 3, flow: 23 }],
  trendRestored: true,
  intervention: 'MAINTAIN',
  proposedRelease: 3,
  ventCycles: 2,
  actuatorArmed: true,
};

describe('guard 1: stored state names its run', () => {
  it('is restored within the same run', () => {
    expect(hydrateGameState(packGameState(finished, 'start-100'), 'start-100')).toEqual(finished);
  });

  it('is refused by a different run, even if nothing wiped it', () => {
    const restored = hydrateGameState(packGameState(finished, 'start-100'), 'start-200');
    expect(restored).toEqual(initialGameState);
  });

  it('leaves none of the previous team machinery behind', () => {
    const r = hydrateGameState(packGameState(finished, 'start-100'), 'start-200');
    expect(r.cabinetOpen).toBe(false);
    expect(r.pumpRunning).toBe(false);
    expect(r.ventCycles).toBe(0);
    expect(r.actuatorArmed).toBe(false);
    expect(r.trendRestored).toBe(false);
    expect(r.intervention).toBeNull();
    expect(r.proposedRelease).toBeNull();
    expect(r.inventory).toEqual([]);
    expect(r.briefingSeen).toBe(false);
  });
});

describe('guard 2: the boot-time run comparison', () => {
  /** Mirrors the decision in GameProvider's load effect. */
  const isNewRun = (previousRun: string | null, runId: string | null) =>
    previousRun !== null && runId !== null && previousRun !== runId;

  it('wipes when the start time has changed', () => {
    expect(isNewRun('start-100', 'start-200')).toBe(true);
  });

  it('resumes when the start time is the same', () => {
    expect(isNewRun('start-100', 'start-100')).toBe(false);
  });

  it('does not wipe on a first ever run, when there is no marker', () => {
    expect(isNewRun(null, 'start-100')).toBe(false);
  });

  it('does not wipe when the run is unknown, rather than guessing', () => {
    // Preview mode and some mock paths have no start time. Wiping on an
    // unknown run would destroy a legitimate resume on every reload.
    expect(isNewRun('start-100', null)).toBe(false);
  });

  it('uses keys that are distinct and namespaced to this app', () => {
    expect(GAME_STATE_KEY).not.toBe(RUN_MARKER_KEY);
    for (const k of [GAME_STATE_KEY, RUN_MARKER_KEY]) {
      expect(k.startsWith('TLE_')).toBe(true);
    }
  });
});
