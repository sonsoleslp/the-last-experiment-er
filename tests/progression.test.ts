/**
 * Progression, puzzle-wiring and state-handling tests.
 *
 * Covers the requirements that cannot be checked by playing: that stages
 * unlock strictly linearly from Escapp-verified data only, that the configured
 * Escapp solutions match what the game actually submits, and that a tampered
 * or stale local blob degrades safely instead of unlocking anything.
 */

import { describe, expect, it } from 'vitest';
import { computeUnlockedStage } from '../src/escapp/EscappProvider';
import {
  ESCAPP_CLIENT_SETTINGS,
  LAST_PUZZLE_ID,
  PUZZLES,
  puzzleForStage,
} from '../src/escapp/puzzles';
import {
  gameReducer,
  hydrateGameState,
  normaliseGameState,
  initialGameState,
  packGameState,
  type GameState,
} from '../src/game/gameState';
import {
  SENSOR_READING_MINUTE,
  T,
  VENT_HOLDS,
  correctIntervention,
  dT,
  earliestSafeRelease,
  evaluateRelease,
  pressureFallRate,
  validPumpSettings,
  ventSafe,
} from '../src/game/model';

describe('Escapp puzzle wiring', () => {
  it('declares exactly five puzzles, one per stage, with ids 1..5', () => {
    expect(PUZZLES).toHaveLength(5);
    expect(PUZZLES.map((p) => p.id)).toEqual([1, 2, 3, 4, 5]);
    expect(PUZZLES.map((p) => p.stage)).toEqual([1, 2, 3, 4, 5]);
    expect(LAST_PUZZLE_ID).toBe(5);
  });

  it('maps each stage to its puzzle', () => {
    for (const p of PUZZLES) expect(puzzleForStage(p.stage).id).toBe(p.id);
    expect(() => puzzleForStage(99)).toThrow();
  });

  /**
   * The documented Escapp solutions must equal what the game builds from the
   * model. If someone changes a model constant, this test fails rather than
   * the room silently becoming unsolvable.
   */
  it('the configured solutions match what each stage actually submits', () => {
    expect(puzzleForStage(1).solution).toBe('417');

    expect(puzzleForStage(2).solution).toBe(String(validPumpSettings()[0]));

    expect(puzzleForStage(3).solution).toBe(correctIntervention(SENSOR_READING_MINUTE));

    const t = earliestSafeRelease()!;
    const c = evaluateRelease(t);
    expect(puzzleForStage(4).solution).toBe(`${t};${c.temperature};${c.rate}`);

    // Stage 5 is the vent actuation: hold pressure; rate derived from it; action.
    const hold = VENT_HOLDS[VENT_HOLDS.length - 1];
    expect(puzzleForStage(5).solution).toBe(`${hold};${pressureFallRate(hold)};RELEASE`);
  });

  it('the stage 5 payload encodes a rate that is genuinely safe to fire at', () => {
    const [hold, rate] = puzzleForStage(5).solution.split(';');
    expect(ventSafe(Number(hold))).toBe(true);
    expect(Number(rate)).toBeCloseTo(pressureFallRate(Number(hold)), 5);
  });

  it('the stage 1 answer is a three-digit number, as the cabinet keypad expects', () => {
    // The badge renders this same value (see IdCard), and the keypad accepts
    // exactly three digits, so anything else would make stage 1 unsolvable.
    expect(puzzleForStage(1).solution).toMatch(/^\d{3}$/);
  });

  it('the stage 4 payload really encodes the justifying temperature and rate', () => {
    const [minute, temp, rate] = puzzleForStage(4).solution.split(';').map(Number);
    expect(T(minute)).toBe(temp);
    expect(dT(minute)).toBe(rate);
  });
});

describe('client settings', () => {
  /**
   * The setting that decides how team synchronisation feels. The client gates
   * onNewErStateCallback behind its own restoreState flow, so this single
   * value is the difference between being told your team moved on and being
   * teleported without explanation.
   */
  /**
   * AUTO means the client adopts team progress without a dialog of its own,
   * because the APP shows the notification instead: the same stage-solved
   * message the solver saw. The gentleness lives in game/progression.ts, which
   * never moves a player before that message has been read.
   */
  it('lets the client adopt team progress silently, so the app can notify', () => {
    expect(ESCAPP_CLIENT_SETTINGS.restoreState).toBe('AUTO');
  });

  it('uses a restoreState value the client actually recognises', () => {
    expect(['NEVER', 'AUTO', 'AUTO_NOTIFICATION', 'REQUEST_USER']).toContain(
      ESCAPP_CLIENT_SETTINGS.restoreState,
    );
  });

  it('links exactly the five puzzles the game submits to', () => {
    expect(ESCAPP_CLIENT_SETTINGS.linkedPuzzleIds).toEqual(PUZZLES.map((p) => p.id));
  });

  /** Never ship an endpoint or credentials in client-side code. */
  it('carries no endpoint and no credentials', () => {
    const keys = Object.keys(ESCAPP_CLIENT_SETTINGS);
    expect(keys).not.toContain('endpoint');
    expect(keys).not.toContain('user');
    expect(JSON.stringify(ESCAPP_CLIENT_SETTINGS)).not.toMatch(/escapeRooms|token|password/i);
  });
});

describe('linear stage progression', () => {
  it('starts at stage 1 with nothing verified', () => {
    expect(computeUnlockedStage([])).toBe(1);
  });

  it('unlocks the next stage only once the previous one is verified', () => {
    expect(computeUnlockedStage([1])).toBe(2);
    expect(computeUnlockedStage([1, 2])).toBe(3);
    expect(computeUnlockedStage([1, 2, 3])).toBe(4);
    expect(computeUnlockedStage([1, 2, 3, 4])).toBe(5);
  });

  it('never exceeds the final stage', () => {
    expect(computeUnlockedStage([1, 2, 3, 4, 5])).toBe(5);
  });

  /** The anti-skip guarantee: a gap holds the team at the gap. */
  it('holds the team at the first gap, however much later progress exists', () => {
    expect(computeUnlockedStage([1, 3, 4, 5])).toBe(2);
    expect(computeUnlockedStage([2, 3, 4, 5])).toBe(1);
    expect(computeUnlockedStage([5])).toBe(1);
    expect(computeUnlockedStage([1, 2, 4, 5])).toBe(3);
  });

  it('ignores junk puzzle ids', () => {
    expect(computeUnlockedStage([0, -1, 99])).toBe(1);
  });
});

describe('local state is never a progression input', () => {
  it('restores a well-formed blob', () => {
    const saved: GameState = {
      ...initialGameState,
      inventory: ['badge', 'accessCard'],
      documents: ['vale-notebook'],
      pumpSetting: 3,
      pumpRunning: true,
      intervention: 'MAINTAIN',
      proposedRelease: 3,
      briefingSeen: true,
    };
    expect(normaliseGameState(saved)).toEqual(saved);
  });

  it('degrades a tampered or stale blob to safe defaults', () => {
    expect(normaliseGameState(null)).toEqual(initialGameState);
    expect(normaliseGameState('nonsense')).toEqual(initialGameState);
    expect(normaliseGameState(42)).toEqual(initialGameState);
    const junk = normaliseGameState({
      inventory: 'not-an-array',
      pumpSetting: 'three',
      intervention: 'CHEAT',
      proposedRelease: { t: 3 },
      cabinetOpen: 'yes',
    });
    expect(junk.inventory).toEqual([]);
    expect(junk.pumpSetting).toBe(0);
    expect(junk.intervention).toBeNull();
    expect(junk.proposedRelease).toBeNull();
    // A truthy-but-wrong value must not open the cabinet.
    expect(junk.cabinetOpen).toBe(false);
  });

  it('carries no stage or verification field an attacker could set', () => {
    const keys = Object.keys(initialGameState);
    expect(keys).not.toContain('stage');
    expect(keys).not.toContain('verifiedStages');
    expect(keys).not.toContain('unlockedStage');
    // Injecting one is dropped by hydration.
    const injected = normaliseGameState({ unlockedStage: 5, verifiedStages: [1, 2, 3, 4, 5] });
    expect(injected as unknown as Record<string, unknown>).not.toHaveProperty('unlockedStage');
    expect(injected).toEqual(initialGameState);
  });
});

describe('persisted state is scoped to a version and a run', () => {
  /**
   * The bug this prevents: `ventCycles` from an earlier playthrough made the
   * final stage open with the vent valve already spent, so the player arrived
   * at a gauge reading they had not produced and was told "vent charge spent"
   * before touching anything.
   */
  const dirty: GameState = {
    ...initialGameState,
    ventCycles: 2,
    actuatorArmed: true,
    pumpRunning: true,
    briefingSeen: true,
  };

  it('restores state belonging to this run', () => {
    const packed = packGameState(dirty, 'run-a');
    expect(hydrateGameState(packed, 'run-a')).toEqual(dirty);
  });

  it('discards state from a DIFFERENT run, so a replay starts clean', () => {
    const packed = packGameState(dirty, 'run-a');
    const restored = hydrateGameState(packed, 'run-b');
    expect(restored).toEqual(initialGameState);
    expect(restored.ventCycles).toBe(0);
    expect(restored.actuatorArmed).toBe(false);
  });

  it('discards an un-versioned blob from before the envelope existed', () => {
    // Exactly the shape that caused the bug: a bare GameState in storage.
    expect(hydrateGameState(dirty as unknown, 'run-a')).toEqual(initialGameState);
  });

  it('discards a blob from an older schema version', () => {
    expect(hydrateGameState({ v: 1, runId: 'run-a', state: dirty }, 'run-a')).toEqual(
      initialGameState,
    );
  });

  it('treats a missing run id consistently rather than guessing', () => {
    const packed = packGameState(dirty, null);
    expect(hydrateGameState(packed, null)).toEqual(dirty);
    expect(hydrateGameState(packed, 'run-a')).toEqual(initialGameState);
  });

  it('survives junk in storage', () => {
    for (const junk of [null, 'nope', 42, [], { v: 'three' }]) {
      expect(hydrateGameState(junk, 'run-a')).toEqual(initialGameState);
    }
  });
});

describe('game reducer', () => {
  it('records inspection and collection without duplicates', () => {
    let s = initialGameState;
    s = gameReducer(s, { type: 'inspect', id: 'desk' });
    s = gameReducer(s, { type: 'inspect', id: 'desk' });
    s = gameReducer(s, { type: 'collect', id: 'badge' });
    s = gameReducer(s, { type: 'collect', id: 'badge' });
    expect(s.inspected).toEqual(['desk']);
    expect(s.inventory).toEqual(['badge']);
  });

  it('the trend channel starts dead and must be restored explicitly', () => {
    expect(initialGameState.trendRestored).toBe(false);
    const s = gameReducer(initialGameState, { type: 'restoreTrend' });
    expect(s.trendRestored).toBe(true);
  });

  it('a tampered blob cannot pre-restore the trend channel with a truthy value', () => {
    expect(normaliseGameState({ trendRestored: 'yes' }).trendRestored).toBe(false);
    expect(normaliseGameState({ trendRestored: 1 }).trendRestored).toBe(false);
    expect(normaliseGameState({ trendRestored: true }).trendRestored).toBe(true);
  });

  it('logs each started setting once, so the log cannot be padded', () => {
    let s = gameReducer(initialGameState, { type: 'logFlow', x: 3, flow: 23 });
    s = gameReducer(s, { type: 'logFlow', x: 3, flow: 23 });
    s = gameReducer(s, { type: 'logFlow', x: 5, flow: 15 });
    expect(s.flowLog).toEqual([
      { x: 3, flow: 23 },
      { x: 5, flow: 15 },
    ]);
  });

  it('drops malformed flow-log entries on restore', () => {
    const restored = normaliseGameState({
      flowLog: [{ x: 3, flow: 23 }, { x: 'two', flow: 21 }, null, { x: 1 }],
    });
    expect(restored.flowLog).toEqual([{ x: 3, flow: 23 }]);
  });

  it('re-dialling the regulator stops the pump, so flow must be re-established', () => {
    let s = gameReducer(initialGameState, { type: 'setPump', value: 3 });
    s = gameReducer(s, { type: 'setPumpRunning', value: true });
    expect(s.pumpRunning).toBe(true);
    s = gameReducer(s, { type: 'setPump', value: 5 });
    expect(s.pumpSetting).toBe(5);
    expect(s.pumpRunning).toBe(false);
  });

  it('counts failed attempts per stage, for the teacher debrief', () => {
    let s = initialGameState;
    s = gameReducer(s, { type: 'recordFailure', stage: 2 });
    s = gameReducer(s, { type: 'recordFailure', stage: 2 });
    s = gameReducer(s, { type: 'recordFailure', stage: 4 });
    expect(s.failedAttempts).toEqual({ 2: 2, 4: 1 });

  });

  it('the vent runs at most two cycles, so there is no third guess', () => {
    let s = initialGameState;
    expect(s.ventCycles).toBe(0);
    s = gameReducer(s, { type: 'vent' });
    expect(s.ventCycles).toBe(1);
    s = gameReducer(s, { type: 'vent' });
    expect(s.ventCycles).toBe(2);
    // The vent charge is spent; further attempts change nothing.
    s = gameReducer(s, { type: 'vent' });
    s = gameReducer(s, { type: 'vent' });
    expect(s.ventCycles).toBe(2);
  });

  it('venting again disarms the actuator, forcing a fresh rate declaration', () => {
    let s = gameReducer(initialGameState, { type: 'vent' });
    s = gameReducer(s, { type: 'armActuator', value: true });
    expect(s.actuatorArmed).toBe(true);
    s = gameReducer(s, { type: 'vent' });
    expect(s.actuatorArmed).toBe(false);
  });

  it('a tampered blob cannot pre-arm the actuator or skip vent cycles', () => {
    expect(normaliseGameState({ actuatorArmed: 'yes' }).actuatorArmed).toBe(false);
    expect(normaliseGameState({ ventCycles: 99 }).ventCycles).toBe(2);
    expect(normaliseGameState({ ventCycles: -5 }).ventCycles).toBe(0);
    expect(normaliseGameState({ ventCycles: 'two' }).ventCycles).toBe(0);
  });

  it('reset returns the initial state', () => {
    const dirty = gameReducer(initialGameState, { type: 'seeBriefing' });
    expect(gameReducer(dirty, { type: 'reset' })).toEqual(initialGameState);
  });
});

