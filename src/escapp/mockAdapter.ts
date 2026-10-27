/**
 * MOCK Escapp adapter: development and testing only.
 *
 * Lets the whole five-stage game be played without an Escapp session. It
 * verifies answers against the solutions in puzzles.ts locally, which is NOT
 * real verification: `isMock` is true, and every surface that reports progress
 * labels it as SIMULATED so a simulated success can never be mistaken for a
 * server-verified one.
 *
 * It also simulates the failure modes the real adapter must handle, so the
 * reconnection UI can be exercised:
 *   ?escappFail=1   every submission fails to reach the server
 *   ?escappOffline=1 the client never connects at all
 */

import { PUZZLES } from './puzzles';
import type { EscappAdapter, EscappStatus, EscappStorage, SubmitResult } from './types';

const STORAGE_KEY = 'TLE_MOCK_ESCAPP_SOLVED';
const RUN_KEY = 'TLE_MOCK_RUN_ID';
const LATENCY_MS = 120;

/**
 * Normalise a solution exactly as the Escapp server does.
 *
 * Verified in the Escapp server source (helpers/utils.js, checkPuzzle):
 *   removeDiacritics(answer.toString().toLowerCase().trim()) === removeDiacritics(sol...)
 *
 * The mock must match this or it would be STRICTER than production, and a
 * local test run could fail an answer that the real server would accept.
 */
const normalise = (s: string): string =>
  s
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const flag = (name: string): boolean => {
  try {
    return new URLSearchParams(window.location.search).get(name) === '1';
  } catch {
    return false;
  }
};

/** A storage shim with the same shape as Escapp's, backed by localStorage. */
const mockStorage = (): EscappStorage => {
  const key = (k: string) => `TLE_MOCK_STORE_${k}`;
  return {
    getSetting: (k) => {
      try {
        const raw = localStorage.getItem(key(k));
        return raw === null ? undefined : JSON.parse(raw);
      } catch {
        return undefined;
      }
    },
    saveSetting: (k, v) => {
      try {
        localStorage.setItem(key(k), JSON.stringify(v));
      } catch {
        /* private browsing */
      }
    },
    removeSetting: (k) => {
      try {
        localStorage.removeItem(key(k));
      } catch {
        /* ignore */
      }
    },
    clear: () => {
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('TLE_MOCK_STORE_'))
          .forEach((k) => localStorage.removeItem(k));
      } catch {
        /* ignore */
      }
    },
    isSupported: () => true,
  };
};

export const createMockAdapter = (): EscappAdapter => {
  const forceFail = flag('escappFail');
  const forceOffline = flag('escappOffline');

  let solved: number[] = [];
  let currentStatus: EscappStatus = 'connecting';
  let stateListener: ((s: number[]) => void) | null = null;
  let restartListener: (() => void) | null = null;
  const store = mockStorage();

  // Mock progress persists across refreshes, mirroring how the real server
  // restores a team's verified progress.
  let runId: string | null = null;

  const load = () => {
    const raw = store.getSetting(STORAGE_KEY);
    solved = Array.isArray(raw) ? (raw as number[]).filter((n) => typeof n === 'number') : [];
    // A run id that survives refreshes but is replaced by __resetMock, so a
    // fresh mock run does not inherit the last one's local state.
    const existing = store.getSetting(RUN_KEY);
    if (typeof existing === 'string') {
      runId = existing;
    } else {
      runId = `mock-${Date.now()}`;
      store.saveSetting(RUN_KEY, runId);
    }
  };
  const persist = () => store.saveSetting(STORAGE_KEY, solved);

  const delay = <T,>(value: T): Promise<T> =>
    new Promise((resolve) => window.setTimeout(() => resolve(value), LATENCY_MS));

  const sendPuzzle = async (
    puzzleId: number,
    solution: string,
    markSolved: boolean,
  ): Promise<SubmitResult> => {
    if (forceFail || currentStatus === 'offline') {
      currentStatus = 'offline';
      return delay({
        verified: false,
        reachedServer: false,
        error: 'SIMULATED failure: mock Escapp is unreachable.',
      });
    }

    const spec = PUZZLES.find((p) => p.id === puzzleId);
    const verified = spec ? normalise(spec.solution) === normalise(solution) : false;

    if (verified && markSolved && !solved.includes(puzzleId)) {
      solved = [...solved, puzzleId].sort((a, b) => a - b);
      persist();
      stateListener?.(solved);
    }
    return delay({ verified, reachedServer: true });
  };

  return {
    isMock: true,
    init: async () => {
      load();
      if (forceOffline) {
        currentStatus = 'offline';
      } else {
        currentStatus = 'ready';
        stateListener?.(solved);
      }
      return delay(currentStatus);
    },
    submit: (puzzleId, solution) => sendPuzzle(puzzleId, solution, true),
    check: (puzzleId, solution) => sendPuzzle(puzzleId, solution, false),
    solvedPuzzles: () => [...solved],
    status: () => currentStatus,
    runId: () => runId,
    statusDetail: () =>
      currentStatus === 'offline' ? 'SIMULATED outage (mock adapter).' : null,
    storage: () => store,
    onStateChange: (fn) => {
      stateListener = (s) => fn(s);
    },
    onRestart: (fn) => {
      restartListener = fn;
    },
    allSolved: () => solved.length === PUZZLES.length,
    isPreview: () => false,
    celebrate: () => {
      /* no animation library in mock mode */
    },
    /** Test helper: wipe simulated progress. Not part of EscappAdapter. */
    ...({
      __resetMock: () => {
        solved = [];
        store.removeSetting(STORAGE_KEY);
        store.removeSetting(RUN_KEY);
        runId = null;
        restartListener?.();
      },
    } as Record<string, unknown>),
  } as EscappAdapter;
};
