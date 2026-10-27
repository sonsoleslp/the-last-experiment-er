/**
 * Detecting a server-side progress reset.
 *
 * The Escapp client only ever moves progress FORWARD. Its comparison is:
 *
 *   _isStateNewestThan = (a, b) =>
 *     a.puzzlesSolved.length !== 0 &&
 *     (b.puzzlesSolved.length === 0 || a.puzzlesSolved.length > b.puzzlesSolved.length);
 *
 * so a state is "newer" only when it has MORE solved puzzles. When a teacher
 * resets a team's progress, the server's list gets shorter, the client decides
 * the server is out of date, and `getSolvedPuzzles()` keeps returning the
 * cached list from before the reset. The team stays exactly where they were.
 *
 * The start time does not change for a reset within the same turn, so the
 * run-marker check cannot see it either. The only reliable signal is the
 * escape-room state the server actually sent, which the client hands to our
 * callbacks even when it decides to ignore it.
 *
 * So: compare what the server says against what the client believes, over the
 * puzzles this app is linked to. If the server knows about fewer, the team was
 * reset, and the server is right.
 */

export interface ResetCheck {
  /** Puzzle ids the SERVER reports as solved, from the erState it sent. */
  serverSolved: number[];
  /** Puzzle ids the CLIENT believes are solved, from getSolvedPuzzles(). */
  clientSolved: number[];
  /** The puzzles this app is linked to; anything else is irrelevant. */
  linkedIds: number[];
}

/** Restrict a list to the puzzles this app cares about, de-duplicated. */
const ours = (ids: number[], linkedIds: number[]): number[] =>
  [...new Set(ids.filter((id) => linkedIds.includes(id)))];

/**
 * Was this team's progress reset on the server?
 *
 * True only when the server reports strictly fewer of our puzzles than the
 * client believes. Being equal is the normal case, and the client being BEHIND
 * the server is also normal (it catches up by itself, because that direction
 * is the one it handles).
 */
export const wasProgressReset = ({
  serverSolved,
  clientSolved,
  linkedIds,
}: ResetCheck): boolean => {
  const server = ours(serverSolved, linkedIds);
  const client = ours(clientSolved, linkedIds);
  return server.length < client.length;
};

/**
 * What the app should treat as solved.
 *
 * The server is the authority. Normally the client agrees, and when it is
 * merely behind it is left alone, because the client resolves that case
 * itself and overriding it would fight the restore flow.
 */
export const authoritativeSolved = ({
  serverSolved,
  clientSolved,
  linkedIds,
}: ResetCheck): number[] => {
  const server = ours(serverSolved, linkedIds);
  const client = ours(clientSolved, linkedIds);
  return server.length < client.length ? server.sort((a, b) => a - b) : client;
};

/**
 * The client caches the escape-room state under this key in its own storage.
 *
 * On a reset it has to be removed, not merely ignored: without it the stale
 * list comes straight back on the next load, because the client would again
 * judge the server's shorter list to be out of date.
 */
export const CLIENT_STATE_KEY = 'localErState';
