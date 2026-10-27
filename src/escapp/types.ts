/**
 * Types for the subset of the Escapp client library this app actually uses.
 *
 * Every member below was verified against the shipped `public/escapp.js`
 * bundle (window.ESCAPP). Nothing here is speculative: if a method is not in
 * this file, the app does not call it.
 */

/** Escape-room state object Escapp passes to callbacks. */
export interface ErState {
  puzzlesSolved?: number[];
  nPuzzles?: number;
  progress?: number;
  score?: number;
  hintsAllowed?: boolean;
  startTime?: string | number | null;
  remainingTime?: number;
  strictTime?: boolean;
  teamId?: number;
  teamMembers?: string[];
  ranking?: unknown[];
  /** Present on failed submissions / connection problems. */
  msg?: string;
}

/** Escapp's localStorage wrapper, from `escapp.getStorage()`. */
export interface EscappStorage {
  getSetting(key: string): unknown;
  saveSetting(key: string, value: unknown): void;
  removeSetting(key: string): void;
  clear(): void;
  isSupported?(): boolean;
}

/** Callback names `registerCallback` accepts (verified in the bundle). */
export type EscappCallbackName =
  | 'initCallback'
  | 'onNewErStateCallback'
  | 'onErRestartCallback';

/** The live Escapp client instance. */
export interface EscappClient {
  validate(cb: (success: boolean, erState?: ErState) => void): void;
  submitPuzzle(
    puzzleId: number,
    solution: string,
    options: Record<string, unknown>,
    cb: (success: boolean, erState?: ErState) => void,
  ): void;
  checkPuzzle(
    puzzleId: number,
    solution: string,
    options: Record<string, unknown>,
    cb: (success: boolean, erState?: ErState) => void,
  ): void;
  getSolvedPuzzles(): number[];
  getUnsolvedPuzzles(): number[];
  getAllPuzzlesSolved(): boolean;
  isERCompleted(): boolean;
  isUserValidParticipant(): boolean;
  isUserLoggedIn(): boolean;
  isPreviewMode(): boolean;
  /** Resolved client settings (exempt from the client's init guard). */
  getSettings(): Record<string, unknown>;
  getStorage(): EscappStorage;
  getAppSettings(): Record<string, unknown>;
  registerCallback(name: EscappCallbackName, fn: (...args: never[]) => void): void;
  displayCustomNotification(text: string, options?: Record<string, unknown>): void;
  startAnimation(name: string, options?: Record<string, unknown>): void;
}

/** Settings accepted by the `new window.ESCAPP(...)` constructor. */
export interface EscappClientSettings {
  endpoint?: string;
  imagesPath?: string;
  linkedPuzzleIds?: number[];
  preview?: boolean;
  rtc?: boolean;
  silent?: boolean;
  notifications?: boolean;
  restoreState?: 'AUTO' | 'AUTO_NOTIFICATION' | 'REQUEST_USER' | 'NEVER';
}

/**
 * Connection / verification status surfaced to the UI.
 *  - `connecting`  : booting the client, validating the participant
 *  - `ready`       : authenticated, Escapp is authoritative
 *  - `auth`        : the client works and the server answered, but this user
 *                    is not a validated participant. Distinct from `offline`
 *                    because the fix is a login/enrolment, not a reconnect.
 *  - `offline`     : Escapp unreachable: show a reconnection state, never
 *                    report progress as verified
 *  - `config`      : the Escapp client refused to initialise (bad endpoint or
 *                    missing linkedPuzzleIds). An author/deployment error.
 *  - `unsupported` : no Escapp client present at all
 */
export type EscappStatus =
  | 'connecting'
  | 'ready'
  | 'auth'
  | 'offline'
  | 'config'
  | 'unsupported';

/** Result of asking Escapp to verify a stage answer. */
export interface SubmitResult {
  /** Escapp verified the solution as correct. */
  verified: boolean;
  /** The submission reached Escapp and got a verdict (right or wrong). */
  reachedServer: boolean;
  /** Human-readable reason when `reachedServer` is false. */
  error?: string;
  /**
   * Escapp rejected an answer that this app considers correct, which means the
   * puzzle's configured solution does not match what the game submits. That is
   * a setup problem, not something the student did, and saying so saves a very
   * frustrating debugging session.
   */
  configMismatch?: boolean;
}

/**
 * The seam between the game and Escapp.
 *
 * Two implementations exist:
 *  - `createProductionAdapter`; the real documented Escapp Client API.
 *  - `createMockAdapter`      : local development, no Escapp session needed.
 *
 * `isMock` is exposed so the UI can label simulated verification clearly and
 * never pass it off as real server verification.
 */
export interface EscappAdapter {
  readonly isMock: boolean;
  /** Boot + authenticate. Resolves with the initial status. */
  init(): Promise<EscappStatus>;
  /** Ask Escapp to verify a stage's answer. */
  submit(puzzleId: number, solution: string): Promise<SubmitResult>;
  /** Record an attempt without solving the puzzle (Escapp `checkPuzzle`). */
  check(puzzleId: number, solution: string): Promise<SubmitResult>;
  /** Puzzle ids Escapp currently reports as solved; the authoritative list. */
  solvedPuzzles(): number[];
  /** Current connection status. */
  status(): EscappStatus;
  /**
   * Extra, human-readable detail about a non-ready status; the specific
   * misconfiguration or refusal, when the adapter can identify it.
   */
  statusDetail(): string | null;
  /** Durable per-team store for local exploration state. */
  storage(): EscappStorage | null;
  /**
   * Identifies the current run, so local state from a previous one can be
   * discarded. Escapp's escape-room start time, or null if unknown.
   */
  runId(): string | null;
  /** Subscribe to Escapp-driven state changes (teammate progress, time). */
  onStateChange(fn: (solved: number[], erState?: ErState) => void): void;
  /** Subscribe to escape-room restart. */
  onRestart(fn: () => void): void;
  /** True once every linked puzzle is solved. */
  allSolved(): boolean;
  /**
   * True during an Escapp author preview run. Verdicts are still the server's,
   * but Escapp does not record an author's practice run, so the UI should say
   * that progress is not being saved.
   */
  isPreview(): boolean;
  /** Optional celebration hook (no-op in the mock). */
  celebrate(): void;
}
