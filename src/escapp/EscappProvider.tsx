/**
 * EscappProvider: boots the chosen Escapp adapter and exposes verified
 * progress to the game.
 *
 * The central rule of this file: *Escapp is the authority on stage
 * completion.* `verifiedStages` is derived only from the adapter's solved
 * puzzle list. The game's own exploration state lives elsewhere (gameState.ts)
 * and can never unlock a stage on its own.
 *
 * Adapter selection:
 *  - `?mock=1`                       -> mock adapter (explicit)
 *  - dev server with no endpoint set  -> mock adapter (so the game is
 *                                        playable with zero setup)
 *  - otherwise                        -> production adapter
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createMockAdapter } from './mockAdapter';
import { createProductionAdapter, escappClientAvailable } from './productionAdapter';
import { LAST_PUZZLE_ID, PUZZLES, puzzleForStage } from './puzzles';
import type { EscappAdapter, EscappStatus, EscappStorage, SubmitResult } from './types';

interface EscappContextValue {
  status: EscappStatus;
  /** Specific diagnosis for a non-ready status, when one is available. */
  statusDetail: string | null;
  /**
   * Set when Escapp rejected an answer the game itself considers correct, i.e.
   * the puzzle's configured solution in Escapp does not match what this stage
   * submits. A setup problem, surfaced to whoever is running the room.
   */
  configError: string | null;
  /** True when verification is simulated locally, not performed by Escapp. */
  isMock: boolean;
  /** Stage numbers Escapp has verified as complete. Authoritative. */
  verifiedStages: number[];
  /** Highest stage the team may enter (first unverified stage). */
  unlockedStage: number;
  /** Every linked puzzle solved. */
  allSolved: boolean;
  /** Escapp author preview run: verdicts are real, progress is not recorded. */
  isPreview: boolean;
  /** Ask Escapp to verify a stage's answer. */
  submitStage(stage: number, solution: string): Promise<SubmitResult>;
  /** Record an attempt for tracking without solving the puzzle. */
  checkStage(stage: number, solution: string): Promise<SubmitResult>;
  /** Escapp's durable per-team store, for local exploration state. */
  storage: EscappStorage | null;
  /** Identifies this run, so stale local state can be discarded. */
  runId: string | null;
  /** Retry connecting after an outage. */
  retry(): void;
  celebrate(): void;
}

const EscappContext = createContext<EscappContextValue | null>(null);

export const useEscapp = (): EscappContextValue => {
  const ctx = useContext(EscappContext);
  if (!ctx) throw new Error('useEscapp must be used inside <EscappProvider>');
  return ctx;
};

const urlFlag = (name: string): boolean => {
  try {
    return new URLSearchParams(window.location.search).get(name) === '1';
  } catch {
    return false;
  }
};

/** Does the environment give the Escapp client a real endpoint to talk to? */
const hasEscappEndpoint = (): boolean => {
  try {
    const settings = window.ESCAPP_APP_SETTINGS as
      | { escappClientSettings?: { endpoint?: string } }
      | undefined;
    const endpoint = settings?.escappClientSettings?.endpoint;
    if (typeof endpoint === 'string' && /\/api\/escapeRooms\/\d+$/.test(endpoint)) return true;
    // Escapp can also pass the endpoint as a URL parameter.
    return new URLSearchParams(window.location.search).has('escapp_endpoint');
  } catch {
    return false;
  }
};

export const chooseAdapter = (): EscappAdapter => {
  if (urlFlag('mock')) return createMockAdapter();
  if (escappClientAvailable() && hasEscappEndpoint()) return createProductionAdapter();
  if (import.meta.env.DEV) {
    console.info(
      '[Escapp] No escape-room endpoint configured: using the MOCK adapter. ' +
        'Copy config.example.mjs to config.mjs to test against a real escape room.',
    );
    return createMockAdapter();
  }
  // Production build with no endpoint: still use the real adapter so the user
  // sees a proper Escapp error rather than fake progress.
  return createProductionAdapter();
};

/** Map Escapp puzzle ids to the stages they verify. */
const stagesFromPuzzles = (solved: number[]): number[] =>
  PUZZLES.filter((p) => solved.includes(p.id))
    .map((p) => p.stage)
    .sort((a, b) => a - b);

/**
 * The first stage the team has NOT had verified.
 *
 * Progression is strictly linear, so we walk up from stage 1 and stop at the
 * first gap. A team that somehow has stage 3 verified but not stage 2 is still
 * held at stage 2: we never skip ahead on inconsistent data.
 */
export const computeUnlockedStage = (verifiedStages: number[]): number => {
  let stage = 1;
  while (verifiedStages.includes(stage) && stage <= PUZZLES.length) stage += 1;
  return Math.min(stage, PUZZLES.length);
};

export const EscappProvider = ({ children }: { children: ReactNode }) => {
  const adapterRef = useRef<EscappAdapter | null>(null);
  if (!adapterRef.current) adapterRef.current = chooseAdapter();
  const adapter = adapterRef.current;

  const [status, setStatus] = useState<EscappStatus>('connecting');
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [solved, setSolved] = useState<number[]>([]);
  const [allSolved, setAllSolved] = useState(false);
  const [storage, setStorage] = useState<EscappStorage | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  /**
   * Puzzle ids Escapp has reported as solved so far. Only used to seed state
   * on boot; the client itself decides when a newer team state is adopted
   * (see restoreState in escapp/puzzles.ts), so the app does not need to tell
   * a teammate's solve apart from its own.
   */
  const knownSolved = useRef<Set<number>>(new Set());
  const [retryToken, setRetryToken] = useState(0);

  /**
   * The in-flight (or settled) boot promise, keyed by retry token.
   *
   * This must survive a remount. React 18 StrictMode mounts every effect
   * twice in development: run → cleanup → run. An earlier version of this
   * effect guarded with a "already booted" ref and bailed out on the second
   * run, which meant the *first* run's init() result was thrown away by its
   * own cleanup flag and the status never left 'connecting'; the app hung on
   * "ESTABLISHING FACILITY UPLINK" forever.
   *
   * Holding the promise in a ref fixes that: init() still runs exactly once
   * per retry, but every mount re-attaches to the same promise, so whichever
   * mount is live when it settles applies the result.
   */
  const bootRef = useRef<{ token: number; promise: Promise<EscappStatus> } | null>(null);

  useEffect(() => {
    // Guards against a settled promise writing into an unmounted tree.
    let active = true;

    // Re-subscribed on every mount; these are setters, not accumulators.
    adapter.onStateChange((nextSolved) => {
      if (!active) return;

      /*
       * Escapp pushes a new escape-room state over its websocket whenever any
       * team member solves a puzzle (needs rtc: true), and only calls this
       * back once its own restoreState flow has resolved. So by the time we
       * get here the player has already been told, or asked, about catching
       * up with their team. Everything below simply follows.
       */
      nextSolved.forEach((id) => knownSolved.current.add(id));
      setSolved(nextSolved);
      setAllSolved(adapter.allSolved());
      setStatus(adapter.status());
      setStatusDetail(adapter.statusDetail());
      setRunId(adapter.runId());
    });

    adapter.onRestart(() => {
      // The teacher restarted the room. Clear our local exploration state and
      // reload so every component re-initialises from an empty slate.
      try {
        adapter.storage()?.removeSetting('TLE_GAME_STATE');
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      window.location.reload();
    });

    // Boot once per retry token, reusing the promise across remounts.
    if (!bootRef.current || bootRef.current.token !== retryToken) {
      bootRef.current = { token: retryToken, promise: adapter.init() };
    }

    void bootRef.current.promise.then((initialStatus) => {
      if (!active) return;
      setStatus(initialStatus);
      setStatusDetail(adapter.statusDetail());
      /*
       * On a reload this is where the team's verified progress comes back.
       * Seeding knownSolved from it means restored progress is not mistaken
       * for a teammate solving something while we watched.
       */
      adapter.solvedPuzzles().forEach((id) => knownSolved.current.add(id));
      setSolved(adapter.solvedPuzzles());
      setAllSolved(adapter.allSolved());
      setStorage(adapter.storage());
      setRunId(adapter.runId());
    });

    return () => {
      active = false;
    };
  }, [adapter, retryToken]);

  const verifiedStages = useMemo(() => stagesFromPuzzles(solved), [solved]);
  const unlockedStage = useMemo(() => computeUnlockedStage(verifiedStages), [verifiedStages]);

  /** Submit a stage answer. Refreshes authoritative progress on any verdict. */
  const submitStage = useCallback(
    async (stage: number, solution: string): Promise<SubmitResult> => {
      const spec = puzzleForStage(stage);
      const result = await adapter.submit(spec.id, solution);
      setStatus(adapter.status());
      setStatusDetail(adapter.statusDetail());

      /*
       * Escapp answered, and said no to the exact string this stage is
       * supposed to submit. The student cannot have done anything wrong, so
       * the puzzle's solution in the Escapp authoring UI must differ from what
       * the game sends. Report it as the setup problem it is: a stage whose
       * configured answer is stale is otherwise completely unsolvable, and the
       * error the player sees would blame them for it.
       */
      if (result.reachedServer && !result.verified && solution === spec.solution) {
        result.configMismatch = true;
        setConfigError(
          `Escapp rejected the correct answer for puzzle ${spec.id} (${spec.title}). ` +
            `Its solution in Escapp must be exactly "${spec.solution}". ` +
            `Until that is fixed this stage cannot be completed.`,
        );
      }
      if (result.reachedServer) {
        setSolved(adapter.solvedPuzzles());
        setAllSolved(adapter.allSolved());
        if (result.verified && spec.id === LAST_PUZZLE_ID) adapter.celebrate();
      }
      return result;
    },
    [adapter],
  );

  const checkStage = useCallback(
    async (stage: number, solution: string): Promise<SubmitResult> => {
      const spec = puzzleForStage(stage);
      const result = await adapter.check(spec.id, solution);
      setStatus(adapter.status());
      setStatusDetail(adapter.statusDetail());
      return result;
    },
    [adapter],
  );

  const retry = useCallback(() => setRetryToken((n) => n + 1), []);

  const value = useMemo<EscappContextValue>(
    () => ({
      status,
      statusDetail,
      configError,
      isMock: adapter.isMock,
      isPreview: adapter.isPreview(),
      verifiedStages,
      unlockedStage,
      allSolved,
      submitStage,
      checkStage,
      storage,
      runId,
      retry,
      celebrate: adapter.celebrate,
    }),
    [status, statusDetail, configError, adapter, verifiedStages, unlockedStage, allSolved, submitStage, checkStage, storage, runId, retry],
  );

  return <EscappContext.Provider value={value}>{children}</EscappContext.Provider>;
};
