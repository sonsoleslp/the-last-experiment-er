/**
 * Production Escapp adapter: uses only the documented Escapp Client API.
 *
 * Responsibilities Escapp owns here: participant authentication, puzzle
 * solution verification, team progress, progress synchronisation. This adapter
 * never decides whether an answer is right; it asks the server and reports the
 * verdict back verbatim.
 *
 * API surface used (all verified present in public/escapp.js):
 *   new window.ESCAPP(settings), validate, submitPuzzle, checkPuzzle,
 *   getSolvedPuzzles, getAllPuzzlesSolved, getStorage, getAppSettings,
 *   registerCallback, displayCustomNotification, startAnimation,
 *   isUserValidParticipant, isPreviewMode
 *
 * AUTHOR PREVIEW MODE. Verified in the Escapp client source: when the client
 * runs with `preview: true` it forces every submission to the readonly
 * `/check_solution` endpoint and, because of that, never adds the puzzle to
 * its local `puzzlesSolved` list. `getSolvedPuzzles()` therefore stays empty
 * for an author no matter how many puzzles they solve correctly.
 *
 * That would strand an author at stage 1, so in preview mode, and ONLY in
 * preview mode; this adapter remembers the verdicts itself. This does not
 * weaken verification: each verdict is still the server's own
 * `correctAnswer`, computed against the configured solution. Escapp is simply
 * declining to *record* an author's practice run, so we hold the result in
 * memory for the duration of that run.
 */

import { ESCAPP_CLIENT_SETTINGS } from './puzzles';
import { CLIENT_STATE_KEY, authoritativeSolved, wasProgressReset } from './reset';
import type {
  ErState,
  EscappAdapter,
  EscappClient,
  EscappStatus,
  EscappStorage,
  SubmitResult,
} from './types';

declare global {
  interface Window {
    ESCAPP?: new (settings: Record<string, unknown>) => EscappClient;
    ESCAPP_APP_SETTINGS?: Record<string, unknown>;
  }
}

/** Guard against React StrictMode double-mounting creating two clients. */
let singleton: EscappClient | null = null;

export const escappClientAvailable = (): boolean =>
  typeof window !== 'undefined' && typeof window.ESCAPP === 'function';

export const createProductionAdapter = (): EscappAdapter => {
  let client: EscappClient | null = null;
  let currentStatus: EscappStatus = 'connecting';
  let detail: string | null = null;
  /** Escape-room start time, which identifies this run. */
  let runId: string | null = null;
  /**
   * The solved list the SERVER last reported, which is the authority. Held
   * separately because the client discards a server list shorter than its own
   * cache, which is exactly what a progress reset looks like.
   */
  let serverSolved: number[] | null = null;
  /** Set once a reset has been acted on, so it is handled only once. */
  let resetHandled = false;
  let stateListener: ((solved: number[], erState?: ErState) => void) | null = null;
  let restartListener: (() => void) | null = null;
  /** Server-verified puzzle ids during an author preview run (see above). */
  const previewSolved = new Set<number>();

  const inPreview = (): boolean => {
    try {
      return client?.isPreviewMode() === true;
    } catch {
      return false;
    }
  };

  /**
   * Read the authoritative solved list, tolerating a half-initialised client.
   * In an author preview run, union in the verdicts Escapp declined to record.
   */
  const readSolved = (): number[] => {
    let fromClient: number[] = [];
    try {
      fromClient = client?.getSolvedPuzzles() ?? [];
    } catch {
      fromClient = [];
    }

    // An author preview run is tracked separately; see above.
    if (previewSolved.size > 0) {
      return [...new Set([...fromClient, ...previewSolved])].sort((a, b) => a - b);
    }

    // The server is the authority, and the client will not move backwards.
    if (serverSolved !== null) {
      return authoritativeSolved({
        serverSolved,
        clientSolved: fromClient,
        linkedIds: ESCAPP_CLIENT_SETTINGS.linkedPuzzleIds,
      });
    }
    return fromClient;
  };

  /**
   * Notice a progress reset done on the server and act on it.
   *
   * The client's cached state has to be deleted, not merely ignored: leave it
   * and the stale list returns on the next load, because the client would
   * again judge the server's shorter list to be out of date. Then the app is
   * told to restart, which wipes local room state and reloads.
   */
  const checkForReset = (erState?: ErState): void => {
    if (!client || resetHandled || inPreview()) return;
    const reported = erState?.puzzlesSolved;
    if (!Array.isArray(reported)) return;

    serverSolved = reported.filter((id) => typeof id === 'number');

    let clientSolved: number[] = [];
    try {
      clientSolved = client.getSolvedPuzzles();
    } catch {
      clientSolved = [];
    }

    if (
      wasProgressReset({
        serverSolved,
        clientSolved,
        linkedIds: ESCAPP_CLIENT_SETTINGS.linkedPuzzleIds,
      })
    ) {
      resetHandled = true;
      try {
        client.getStorage()?.removeSetting(CLIENT_STATE_KEY);
      } catch {
        /* storage unavailable; the restart below still helps */
      }
      restartListener?.();
    }
  };

  const init = (): Promise<EscappStatus> =>
    new Promise((resolve) => {
      if (!escappClientAvailable()) {
        currentStatus = 'unsupported';
        detail = 'window.ESCAPP was not defined: escapp.js did not load.';
        resolve(currentStatus);
        return;
      }

      // The client reads window.ESCAPP_APP_SETTINGS (endpoint, preview, rtc,
      // locale) from its environment and merges it over what we pass here.
      client = singleton ?? new window.ESCAPP!(ESCAPP_CLIENT_SETTINGS);
      singleton = client;

      // Teammate solved something / timer ticked / state restored.
      client.registerCallback('onNewErStateCallback', ((erState: ErState) => {
        currentStatus = 'ready';
        if (erState?.startTime != null) runId = String(erState.startTime);
        checkForReset(erState);
        stateListener?.(readSolved(), erState);
      }) as never);

      // The room was restarted by the teacher: drop our local exploration
      // state so the team genuinely starts over.
      client.registerCallback('onErRestartCallback', (() => {
        restartListener?.();
      }) as never);

      // Escapp renders its own login/validation UI over the page during this
      // call. We only consider ourselves ready once it succeeds.
      let settled = false;
      const settle = (status: EscappStatus, why: string | null = null) => {
        if (settled) return;
        settled = true;
        currentStatus = status;
        detail = why;
        resolve(status);
      };

      /*
       * Pre-flight 1: did the Escapp client actually initialise?
       *
       * The client wraps its own public methods in an initialisation guard: if
       * init() recorded an error (bad endpoint format, or preview mode with no
       * linkedPuzzleIds) the wrapped methods return `undefined` and do nothing
       *: including validate(), which then never invokes our callback at all.
       * `getSettings`/`getAppSettings`/`isSupported` are exempt from the
       * guard, so a wrapped getter returning undefined is a reliable probe.
       *
       * Without this check a misconfigured endpoint shows up as a 20-second
       * hang followed by a misleading "uplink lost".
       */
      if (typeof client.isPreviewMode() !== 'boolean') {
        settle(
          'config',
          'The Escapp client refused to initialise. Check that the endpoint looks like ' +
            'https://host/api/escapeRooms/<id> and that linkedPuzzleIds is set.',
        );
        return;
      }

      /*
       * Pre-flight 2: does author preview have the credentials it needs?
       *
       * Authors ARE allowed to play in preview/test mode: retrieveState()
       * accepts participation "AUTHOR" as well as "PARTICIPANT" when
       * `preview` is set. What preview mode cannot do is *ask* who you are:
       *
       *   - `preview: true` forces `silent: true`, and in silent mode
       *     validateUser() returns false immediately instead of showing the
       *     login dialog;
       *   - validateUser() specifically requires `user.token` to be a string,
       *     so an email + password in settings is not sufficient;
       *   - init() calls _resetForPreview(), which CLEARS Escapp's storage, so
       *     a token remembered from an earlier sign-in is wiped before it can
       *     be read.
       *
       * So a preview run needs its credentials passed in by URL
       * (escapp_email + escapp_token), which is precisely what Escapp's own
       * test-mode launch does. A hand-written local config has none, so say
       * that plainly rather than reporting a network problem that isn't there.
       */
      const settings = client.getSettings() as
        | { preview?: boolean; user?: { email?: string; token?: string; password?: string } }
        | undefined;
      const hasCredentials =
        typeof settings?.user?.email === 'string' &&
        (typeof settings?.user?.token === 'string' || typeof settings?.user?.password === 'string');

      if (settings?.preview === true && !hasCredentials) {
        settle(
          'auth',
          'Author preview mode needs credentials passed in the URL, and none were supplied. ' +
            'Authors can play in test mode, but launch it from Escapp (which adds them for you), ' +
            'or append ?escapp_email=<your-email>&escapp_token=<token> to this URL.',
        );
        return;
      }

      // If validate() never calls back (server unreachable), surface a
      // reconnection state rather than hanging on a black screen.
      const timeout = window.setTimeout(() => settle('offline'), 20000);

      try {
        client.validate((success, erState) => {
          window.clearTimeout(timeout);
          if (success) {
            if (erState?.startTime != null) runId = String(erState.startTime);
            checkForReset(erState);
            stateListener?.(readSolved(), erState);
            settle('ready');
            return;
          }
          /*
           * validate() answered "no". If the client got far enough to log the
           * user in, the server was reachable and the refusal is about this
           * user's participation (wrong account, not on a team, turn not
           * running, author rather than participant); an auth problem, not a
           * connectivity one.
           */
          let loggedIn = false;
          try {
            loggedIn = client?.isUserLoggedIn() === true;
          } catch {
            loggedIn = false;
          }
          if (loggedIn) {
            // Authors are accepted in preview/test mode but not on a live
            // room, so the useful advice differs.
            let preview = false;
            try {
              preview = client?.isPreviewMode() === true;
            } catch {
              preview = false;
            }
            settle(
              'auth',
              preview
                ? 'Signed in, but Escapp did not accept this account for this escape room. ' +
                    'Check that the credentials belong to the author or a participant of room ' +
                    'and that the escape room still exists.'
                : 'Signed in, but this account is not a validated participant of this live room. ' +
                    'Either use test mode (preview), or sign in with a student account that ' +
                    'belongs to a team in a turn that is currently running.',
            );
          } else {
            settle(
              'offline',
              'Escapp did not validate the participant. The sign-in may have been cancelled, or ' +
                'the escape room may not be reachable.',
            );
          }
        });
      } catch (e) {
        window.clearTimeout(timeout);
        console.warn('Escapp: validate() threw', e);
        settle('offline', (e as Error).message || null);
      }
    });

  /**
   * Shared submit/check path. Distinguishes three outcomes:
   *   verified         : Escapp says the solution is correct
   *   wrong but online : Escapp answered, solution incorrect
   *   unreachable      ; no verdict; caller must NOT treat this as progress
   */
  const sendPuzzle = (
    method: 'submitPuzzle' | 'checkPuzzle',
    puzzleId: number,
    solution: string,
  ): Promise<SubmitResult> =>
    new Promise((resolve) => {
      if (!client || currentStatus === 'unsupported') {
        resolve({
          verified: false,
          reachedServer: false,
          error: 'The Escapp client is not available.',
        });
        return;
      }

      let settled = false;
      const done = (r: SubmitResult) => {
        if (settled) return;
        settled = true;
        if (!r.reachedServer && currentStatus === 'ready') {
          currentStatus = 'offline';
          detail = r.error ?? null;
        }
        resolve(r);
      };

      const timeout = window.setTimeout(
        () =>
          done({
            verified: false,
            reachedServer: false,
            error: 'Escapp did not respond. Your answer was not verified.',
          }),
        15000,
      );

      try {
        client[method](puzzleId, solution, {}, (success, erState) => {
          window.clearTimeout(timeout);
          // Escapp reports connection problems through erState.msg while
          // success is false, so a message plus failure means "no verdict".
          const transportError =
            !success && typeof erState?.msg === 'string' && erState.msg.length > 0;
          if (transportError) {
            done({ verified: false, reachedServer: false, error: erState!.msg });
            return;
          }
          currentStatus = 'ready';
          // A real submit that the server accepted, in a preview run Escapp
          // will not persist: remember it so progression still works.
          if (success && method === 'submitPuzzle' && inPreview()) {
            previewSolved.add(puzzleId);
          }
          // The response carries the server's current list; keep it as the
          // authority so a reset between actions is not missed.
          if (Array.isArray(erState?.puzzlesSolved)) {
            serverSolved = erState.puzzlesSolved.filter((id) => typeof id === 'number');
          }
          stateListener?.(readSolved(), erState);
          done({ verified: success, reachedServer: true });
        });
      } catch (e) {
        window.clearTimeout(timeout);
        done({
          verified: false,
          reachedServer: false,
          error: (e as Error).message || 'Escapp submission failed.',
        });
      }
    });

  return {
    isMock: false,
    init,
    submit: (puzzleId, solution) => sendPuzzle('submitPuzzle', puzzleId, solution),
    check: (puzzleId, solution) => sendPuzzle('checkPuzzle', puzzleId, solution),
    solvedPuzzles: readSolved,
    status: () => currentStatus,
    statusDetail: () => detail,
    runId: () => runId,
    storage: (): EscappStorage | null => {
      try {
        return client?.getStorage() ?? null;
      } catch {
        return null;
      }
    },
    onStateChange: (fn) => {
      stateListener = fn;
    },
    onRestart: (fn) => {
      restartListener = fn;
    },
    allSolved: () => {
      if (inPreview()) {
        return ESCAPP_CLIENT_SETTINGS.linkedPuzzleIds.every((id) => readSolved().includes(id));
      }
      try {
        return client?.getAllPuzzlesSolved() ?? false;
      } catch {
        return false;
      }
    },
    /** True during an author preview run, so the UI can say so. */
    isPreview: () => inPreview(),
    celebrate: () => {
      try {
        client?.startAnimation('confetti');
      } catch {
        /* decorative only */
      }
    },
  };
};
