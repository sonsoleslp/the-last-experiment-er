/**
 * The `?reset=1` escape hatch.
 *
 * It exists because detecting a server-side reset from inside the app is not
 * reliably possible: the client judges the emptied server list to be out of
 * date and hands the app its own stale copy instead. This lever needs nothing
 * from the server and works in every mode, including `?mock=1`.
 *
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { applyResetHatch, isResetRequested, keysToWipe } from '../src/resetHatch';

const at = (search: string) => window.history.replaceState({}, '', `/${search}`);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  at('');
});

describe('recognising the request', () => {
  it('turns on for ?reset=1', () => {
    at('?reset=1');
    expect(isResetRequested()).toBe(true);
  });

  it('stays off otherwise', () => {
    for (const q of ['', '?reset=0', '?reset=', '?reset=true', '?mock=1']) {
      at(q);
      expect(isResetRequested(), `"${q}"`).toBe(false);
    }
  });
});

describe('what gets wiped', () => {
  it('clears this app and the client cache, which is where stale progress lives', () => {
    expect(
      keysToWipe(['TLE_GAME_STATE', 'TLE_RUN_ID', 'ESCAPP_939_1-2-3-4-5', 'TLE_MOCK_ESCAPP_SOLVED']),
    ).toEqual(['TLE_GAME_STATE', 'TLE_RUN_ID', 'ESCAPP_939_1-2-3-4-5', 'TLE_MOCK_ESCAPP_SOLVED']);
  });

  it('keeps the sound preference, which is not progress', () => {
    expect(keysToWipe(['TLE_MUTED'])).toEqual([]);
    expect(keysToWipe(['TLE_MUTED', 'TLE_GAME_STATE'])).toEqual(['TLE_GAME_STATE']);
  });

  it('leaves unrelated keys on the origin alone', () => {
    expect(keysToWipe(['i18nextLng', 'theme', 'somethingElse'])).toEqual([]);
  });
});

describe('applying it', () => {
  it('removes stored progress but not the preference', () => {
    localStorage.setItem('TLE_GAME_STATE', '{"v":3}');
    localStorage.setItem('ESCAPP_939_1-2-3-4-5', '{"localErState":1}');
    localStorage.setItem('TLE_MUTED', '1');
    sessionStorage.setItem('x', 'y');
    at('?reset=1');

    expect(applyResetHatch()).toBe(true);
    expect(localStorage.getItem('TLE_GAME_STATE')).toBeNull();
    expect(localStorage.getItem('ESCAPP_939_1-2-3-4-5')).toBeNull();
    expect(localStorage.getItem('TLE_MUTED')).toBe('1');
    expect(sessionStorage.getItem('x')).toBeNull();
  });

  it('drops the parameter, so a later refresh is not another reset', () => {
    at('?reset=1&mock=1');
    applyResetHatch();
    expect(window.location.search).not.toContain('reset');
    // Other parameters survive, so ?mock=1&reset=1 still lands in mock mode.
    expect(window.location.search).toContain('mock=1');
    expect(isResetRequested()).toBe(false);
  });

  it('does nothing at all without the parameter', () => {
    localStorage.setItem('TLE_GAME_STATE', '{"v":3}');
    expect(applyResetHatch()).toBe(false);
    expect(localStorage.getItem('TLE_GAME_STATE')).toBe('{"v":3}');
  });
});
