/**
 * The production adapter against a client that answers like the real one.
 *
 * Every other test in this suite runs on the MOCK adapter, which keeps its own
 * flat list of solved puzzles. That left the production adapter's reading of
 * Escapp's responses completely uncovered, and a real bug lived there: the
 * player's own verified solve was discarded, so no stage was ever unlocked and
 * the proceed control never appeared. Only for the person who submitted;
 * teammates are updated from a genuine erState over the websocket, which is
 * why it was reported as "it shows for the team member but not for one self".
 *
 * The fake below copies the two response shapes from the real client, which is
 * the whole point of the test:
 *
 *   validate(cb)            -> cb(true, erState)
 *   submitPuzzle(..., cb)   -> cb(correct, RESPONSE BODY)   <- NOT an erState
 *
 * where the body is {code, correctAnswer, msg, erState} and the escape-room
 * state is NESTED. Reading puzzlesSolved off the body silently yielded
 * undefined, so the adapter kept the empty list validate() gave it at boot.
 *
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EscappAdapter, EscappClient, PuzzleResponse } from '../src/escapp/types';

const START_TIME = '2026-10-27T09:00:00.000Z';

/** A stand-in for the Escapp client, faithful to the shapes that matter. */
const makeFakeClient = (opts: { solvedAtBoot?: number[] } = {}) => {
  /* The client's own cache, exactly what getSolvedPuzzles() reads. */
  const localErState = {
    puzzlesSolved: [...(opts.solvedAtBoot ?? [])],
    startTime: START_TIME,
  };
  /* The server's record. Starts in step with the client. */
  const serverSolved = [...(opts.solvedAtBoot ?? [])];
  const callbacks: Record<string, (...a: never[]) => void> = {};

  const client: EscappClient = {
    validate: (cb) => {
      // The real client passes a genuine erState here.
      cb(true, { puzzlesSolved: [...serverSolved], startTime: START_TIME });
    },
    submitPuzzle: (puzzleId, solution, _options, cb) => {
      const correct = solution === '417' ? puzzleId === 1 : solution === String(puzzleId);
      if (correct) {
        if (!localErState.puzzlesSolved.includes(puzzleId)) {
          localErState.puzzlesSolved.push(puzzleId);
        }
        if (!serverSolved.includes(puzzleId)) serverSolved.push(puzzleId);
      }
      // The real client passes the RESPONSE BODY, not an erState.
      const body: PuzzleResponse = {
        code: 'OK',
        correctAnswer: correct,
        erState: { puzzlesSolved: [...serverSolved], startTime: START_TIME },
      };
      cb(correct, body);
    },
    checkPuzzle: (puzzleId, solution, _options, cb) => {
      const correct = solution === String(puzzleId);
      cb(correct, {
        code: 'OK',
        correctAnswer: correct,
        erState: { puzzlesSolved: [...serverSolved], startTime: START_TIME },
      });
    },
    getSolvedPuzzles: () => [...localErState.puzzlesSolved],
    getUnsolvedPuzzles: () => [1, 2, 3, 4, 5].filter((i) => !localErState.puzzlesSolved.includes(i)),
    getAllPuzzlesSolved: () => localErState.puzzlesSolved.length === 5,
    isERCompleted: () => false,
    isUserValidParticipant: () => true,
    isUserLoggedIn: () => true,
    isPreviewMode: () => false,
    getSettings: () => ({ preview: false, user: { email: 'a@b.c', token: 't' } }),
    getStorage: () => ({
      getSetting: () => undefined,
      saveSetting: () => {},
      removeSetting: () => {},
      clear: () => {},
      isSupported: () => true,
    }),
    getAppSettings: () => ({}),
    registerCallback: (name, fn) => {
      callbacks[name] = fn;
    },
    displayCustomNotification: () => {},
    startAnimation: () => {},
  };

  return { client, callbacks, serverSolved, localErState };
};

let fake: ReturnType<typeof makeFakeClient>;

/*
 * The adapter module keeps one client in a module-level singleton, so that a
 * StrictMode double-mount cannot build two. Tests therefore need a fresh copy
 * of the module each time, or the first test's client is reused by them all.
 */
const freshAdapter = async (): Promise<EscappAdapter> => {
  vi.resetModules();
  const mod = await import('../src/escapp/productionAdapter');
  return mod.createProductionAdapter();
};

beforeEach(() => {
  fake = makeFakeClient();
  (window as unknown as { ESCAPP: unknown }).ESCAPP = function ESCAPP() {
    return fake.client;
  } as unknown;
});

describe('the adapter reads Escapp’s submit response correctly', () => {
  it('reports a puzzle the player just solved themselves', async () => {
    const adapter = await freshAdapter();
    expect(await adapter.init()).toBe('ready');
    expect(adapter.solvedPuzzles()).toEqual([]);

    const result = await adapter.submit(1, '417');
    expect(result.verified).toBe(true);
    expect(result.reachedServer).toBe(true);

    // The regression: this came back [] because serverSolved was still the
    // empty list validate() reported at boot, and the adapter treated the
    // client being AHEAD of that stale list as a progress reset.
    expect(adapter.solvedPuzzles(), 'your own verified solve must count').toEqual([1]);
  });

  it('keeps counting solves as the player works through the room', async () => {
    const adapter = await freshAdapter();
    await adapter.init();

    await adapter.submit(1, '417');
    expect(adapter.solvedPuzzles()).toEqual([1]);
    await adapter.submit(2, '2');
    expect(adapter.solvedPuzzles()).toEqual([1, 2]);
    await adapter.submit(3, '3');
    expect(adapter.solvedPuzzles()).toEqual([1, 2, 3]);
  });

  it('tells the app about the new progress, not just the caller', async () => {
    const adapter = await freshAdapter();
    await adapter.init();

    const seen: number[][] = [];
    adapter.onStateChange((solved) => seen.push(solved));

    await adapter.submit(1, '417');
    expect(seen[seen.length - 1], 'the state listener drives the whole UI').toEqual([1]);
  });

  it('does not count a wrong answer', async () => {
    const adapter = await freshAdapter();
    await adapter.init();

    const result = await adapter.submit(1, '999');
    expect(result.verified).toBe(false);
    expect(adapter.solvedPuzzles()).toEqual([]);
  });

  it('resumes a team that already had progress before this browser joined', async () => {
    fake = makeFakeClient({ solvedAtBoot: [1, 2] });
    const adapter = await freshAdapter();
    await adapter.init();

    expect(adapter.solvedPuzzles()).toEqual([1, 2]);
    await adapter.submit(3, '3');
    expect(adapter.solvedPuzzles()).toEqual([1, 2, 3]);
  });

  it('treats a connection problem as no verdict rather than a wrong answer', async () => {
    fake.client.submitPuzzle = (_id, _sol, _o, cb) => cb(false, { msg: 'Network error' });
    const adapter = await freshAdapter();
    await adapter.init();

    const result = await adapter.submit(1, '417');
    expect(result.verified).toBe(false);
    expect(result.reachedServer).toBe(false);
    expect(result.error).toBe('Network error');
    expect(adapter.solvedPuzzles()).toEqual([]);
  });
});
