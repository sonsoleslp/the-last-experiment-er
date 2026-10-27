/**
 * Detecting a progress reset done on the server.
 *
 * Reported: "I restarted the team's progress and it is not restarting."
 *
 * Cause: the Escapp client only moves progress forward. Its comparison is
 *
 *   _isStateNewestThan = (a, b) =>
 *     a.puzzlesSolved.length !== 0 &&
 *     (b.puzzlesSolved.length === 0 || a.puzzlesSolved.length > b.puzzlesSolved.length);
 *
 * so a state counts as newer only when it has MORE solved puzzles. After a
 * reset the server's list is SHORTER, the client decides the server is out of
 * date, and getSolvedPuzzles() keeps returning the pre-reset list. The start
 * time does not change for a reset inside the same turn, so the run-marker
 * check cannot see it either.
 */

import { describe, expect, it } from 'vitest';
import { CLIENT_STATE_KEY, authoritativeSolved, wasProgressReset } from '../src/escapp/reset';
import { ESCAPP_CLIENT_SETTINGS } from '../src/escapp/puzzles';

const linkedIds = ESCAPP_CLIENT_SETTINGS.linkedPuzzleIds;
const check = (serverSolved: number[], clientSolved: number[]) => ({
  serverSolved,
  clientSolved,
  linkedIds,
});

describe('spotting the reset', () => {
  it('spots a full reset of a team that had finished', () => {
    expect(wasProgressReset(check([], [1, 2, 3, 4, 5]))).toBe(true);
  });

  it('spots a full reset of a team part way through', () => {
    expect(wasProgressReset(check([], [1, 2]))).toBe(true);
  });

  it('spots a partial reset, where only some puzzles were cleared', () => {
    expect(wasProgressReset(check([1], [1, 2, 3]))).toBe(true);
  });

  it('does not fire when the two agree', () => {
    for (const solved of [[], [1], [1, 2], [1, 2, 3, 4, 5]]) {
      expect(wasProgressReset(check(solved, solved)), `${solved}`).toBe(false);
    }
  });

  /**
   * The client being BEHIND the server is the ordinary case: a teammate solved
   * something and the client has not caught up. It handles that direction
   * itself, so this must stay quiet or it would fight the restore flow.
   */
  it('does not fire when the client is merely behind the server', () => {
    expect(wasProgressReset(check([1, 2, 3], [1, 2]))).toBe(false);
    expect(wasProgressReset(check([1], []))).toBe(false);
  });

  it('ignores puzzles this app is not linked to', () => {
    // Another app's puzzles disappearing is not our reset.
    expect(wasProgressReset(check([1, 2], [1, 2, 99]))).toBe(false);
    expect(wasProgressReset(check([1, 2, 77], [1, 2]))).toBe(false);
  });

  it('is not confused by duplicates or ordering', () => {
    expect(wasProgressReset(check([2, 1], [1, 1, 2, 2]))).toBe(false);
    expect(wasProgressReset(check([1, 1], [1, 2]))).toBe(true);
  });
});

describe('which list the app should believe', () => {
  it('takes the server list after a reset', () => {
    expect(authoritativeSolved(check([], [1, 2, 3]))).toEqual([]);
    expect(authoritativeSolved(check([1], [1, 2, 3]))).toEqual([1]);
  });

  it('leaves the client list alone otherwise', () => {
    expect(authoritativeSolved(check([1, 2], [1, 2]))).toEqual([1, 2]);
    // Client behind: untouched, because the client resolves that itself.
    expect(authoritativeSolved(check([1, 2, 3], [1, 2]))).toEqual([1, 2]);
  });

  it('returns the reset list sorted, so stage mapping is stable', () => {
    expect(authoritativeSolved(check([3, 1], [1, 2, 3, 4]))).toEqual([1, 3]);
  });
});

describe('the client cache must be deleted, not just ignored', () => {
  it('knows the key the client caches its state under', () => {
    // Without removing this, the stale list returns on the next load, because
    // the client would again judge the server's shorter list to be out of date.
    expect(CLIENT_STATE_KEY).toBe('localErState');
  });
});
