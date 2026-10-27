/**
 * `?reset=1`: wipe everything this browser remembers and start clean.
 *
 * This exists because detecting a server-side reset automatically turned out
 * to be unreliable, for a reason buried in the client:
 *
 *   - `teamController.resetProgress` on the server deletes the team's solved
 *     puzzles and clears their start time, so the server's list really is
 *     empty afterwards.
 *   - But the client only moves progress forward. `_isStateNewestThan` counts
 *     a state as newer only when it has MORE solved puzzles, so it judges the
 *     emptied server list to be out of date.
 *   - Worse, `_updateErStates` is called with `_getNewestState()`, which in
 *     that situation returns the STALE LOCAL state, and it clears
 *     `remoteErState` on the way through. So by the time the app's callback
 *     runs, the server's real list is gone and every number the app can see
 *     is the stale one.
 *
 * There is no honest way for the app to tell, from what it is given, that a
 * reset happened. So this is the manual lever: it works in every mode,
 * including `?mock=1` where there is no Escapp session at all, and it needs
 * nothing from the server.
 *
 * Run it BEFORE anything reads storage, which means before the Escapp client
 * is constructed.
 */

/** Keys worth keeping: a per-person preference, not progress. */
const KEEP = ['TLE_MUTED'];

/**
 * Namespaces to clear. `TLE_` is this app's own; `ESCAPP_` is the client's,
 * which is where the stale solved-puzzle cache lives and so has to go too.
 * Clearing it also drops the stored login, so the team signs in again, which
 * is the right behaviour when handing a machine to a new team.
 */
const NAMESPACES = ['TLE_', 'ESCAPP_'];

export const isResetRequested = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).get('reset') === '1';
  } catch {
    return false;
  }
};

/** Everything that would be removed. Exported so it can be tested. */
export const keysToWipe = (allKeys: string[]): string[] =>
  allKeys.filter((k) => NAMESPACES.some((n) => k.startsWith(n)) && !KEEP.includes(k));

/**
 * Wipe local state if `?reset=1` is present, then drop the parameter from the
 * URL so a later refresh does not wipe a game in progress.
 */
export const applyResetHatch = (): boolean => {
  if (!isResetRequested()) return false;

  try {
    for (const key of keysToWipe(Object.keys(localStorage))) {
      localStorage.removeItem(key);
    }
  } catch {
    /* private browsing: nothing was stored anyway */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }

  // Leave a clean URL behind, so refreshing later is not another reset.
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('reset');
    window.history.replaceState({}, '', url.toString());
  } catch {
    /* ignore */
  }

  return true;
};
