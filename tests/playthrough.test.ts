/**
 * End-to-end playthrough against the real mock adapter.
 *
 * This drives the actual adapter code (not a stub) through the whole game the
 * way the stages do, and asserts the properties that matter in a classroom:
 * a correct run completes, every wrong answer is rejected without granting
 * progress, progress survives a refresh, and an Escapp outage never produces
 * false completion.
 *
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { computeUnlockedStage } from '../src/escapp/EscappProvider';
import { createMockAdapter } from '../src/escapp/mockAdapter';
import { PUZZLES, puzzleForStage } from '../src/escapp/puzzles';
import type { EscappAdapter } from '../src/escapp/types';
import {
  MIN_FLOW,
  PUMP_SETTINGS,
  Q,
  RELEASE_CANDIDATES,
  SENSOR_READING_MINUTE,
  VENT_HOLDS,
  correctIntervention,
  earliestSafeRelease,
  evaluateRelease,
  pressureFallRate,
  validPumpSettings,
} from '../src/game/model';

/** Point the mock adapter's URL-flag reader at a given query string. */
const setSearch = (search: string) => {
  window.history.replaceState({}, '', `/${search}`);
};

/** Stage -> the string that stage submits for a correct play. */
const correctSubmission = (stage: number): string => {
  switch (stage) {
    case 1:
      return '417';
    case 2:
      return String(validPumpSettings()[0]);
    case 3:
      return correctIntervention(SENSOR_READING_MINUTE);
    case 4: {
      const t = earliestSafeRelease()!;
      const c = evaluateRelease(t);
      return `${t};${c.temperature};${c.rate}`;
    }
    case 5: {
      // The vent actuation: hold pressure; the rate derived from it; action.
      const hold = VENT_HOLDS[VENT_HOLDS.length - 1];
      return `${hold};${pressureFallRate(hold)};RELEASE`;
    }
    default:
      throw new Error(`no stage ${stage}`);
  }
};

/** Stage completion as the EscappProvider derives it. */
const unlockedFrom = (adapter: EscappAdapter) =>
  computeUnlockedStage(
    PUZZLES.filter((p) => adapter.solvedPuzzles().includes(p.id)).map((p) => p.stage),
  );

describe('full correct playthrough', () => {
  beforeEach(() => {
    localStorage.clear();
    setSearch('?mock=1');
  });

  it('completes all five stages in order and reports the room solved', async () => {
    const adapter = createMockAdapter();
    expect(await adapter.init()).toBe('ready');
    expect(adapter.solvedPuzzles()).toEqual([]);
    expect(unlockedFrom(adapter)).toBe(1);

    for (const stage of [1, 2, 3, 4, 5]) {
      // The team can only be at the stage they have unlocked.
      expect(unlockedFrom(adapter)).toBe(stage);
      expect(adapter.allSolved()).toBe(false);

      const result = await adapter.submit(puzzleForStage(stage).id, correctSubmission(stage));
      expect(result.reachedServer).toBe(true);
      expect(result.verified).toBe(true);
      expect(adapter.solvedPuzzles()).toContain(stage);
    }

    expect(adapter.solvedPuzzles()).toEqual([1, 2, 3, 4, 5]);
    expect(adapter.allSolved()).toBe(true);
    expect(unlockedFrom(adapter)).toBe(5);
  });
});

describe('wrong answers never grant progress', () => {
  beforeEach(() => {
    localStorage.clear();
    setSearch('?mock=1');
  });

  it('rejects every wrong cabinet code in stage 1', async () => {
    const adapter = createMockAdapter();
    await adapter.init();
    // Note: '417 ' is NOT here — the Escapp server trims, so it is a correct
    // answer and the mock matches that behaviour (see the matching tests below).
    for (const code of ['000', '123', '714', '41', '4170', '4 1 7']) {
      const r = await adapter.submit(1, code);
      expect(r.reachedServer).toBe(true);
      expect(r.verified).toBe(false);
    }
    expect(adapter.solvedPuzzles()).toEqual([]);
    expect(unlockedFrom(adapter)).toBe(1);
  });

  it('rejects every pump setting that misses the protocol minimum', async () => {
    const adapter = createMockAdapter();
    await adapter.init();
    await adapter.submit(1, '417');

    for (const x of PUMP_SETTINGS) {
      const r = await adapter.submit(2, String(x));
      if (Q(x) >= MIN_FLOW) {
        expect(r.verified, `setting ${x} delivers ${Q(x)} L/min and should pass`).toBe(true);
      } else {
        expect(r.verified, `setting ${x} delivers ${Q(x)} L/min and must fail`).toBe(false);
      }
    }
    // Exactly one setting ever unlocked it.
    expect(adapter.solvedPuzzles()).toEqual([1, 2]);
  });

  it('rejects suppression in stage 3 — the chamber is cooling', async () => {
    const adapter = createMockAdapter();
    await adapter.init();
    await adapter.submit(1, '417');
    await adapter.submit(2, correctSubmission(2));

    const wrong = await adapter.submit(3, 'SUPPRESSION');
    expect(wrong.verified).toBe(false);
    expect(unlockedFrom(adapter)).toBe(3);

    const right = await adapter.submit(3, 'MAINTAIN');
    expect(right.verified).toBe(true);
    expect(unlockedFrom(adapter)).toBe(4);
  });

  it('rejects every unsafe release window in stage 4, including the coldest one', async () => {
    const adapter = createMockAdapter();
    await adapter.init();
    for (const s of [1, 2, 3]) await adapter.submit(puzzleForStage(s).id, correctSubmission(s));

    for (const t of RELEASE_CANDIDATES) {
      const c = evaluateRelease(t);
      const r = await adapter.submit(4, `${t};${c.temperature};${c.rate}`);
      expect(r.verified, `minute ${t} safe=${c.safe}`).toBe(c.safe);
    }
    expect(adapter.solvedPuzzles()).toContain(4);
  });

  it('refuses a vent actuation declared at the wrong rate or the wrong hold', async () => {
    const adapter = createMockAdapter();
    await adapter.init();
    for (const s of [1, 2, 3, 4]) await adapter.submit(puzzleForStage(s).id, correctSubmission(s));

    const unsafeHold = VENT_HOLDS[0];
    for (const bad of [
      // Fired at the first hold, where the rate exceeds the actuator limit.
      `${unsafeHold};${pressureFallRate(unsafeHold)};RELEASE`,
      // Right hold, gave the pressure instead of the rate.
      '18;18;RELEASE',
      // Right hold, gave only the decay constant.
      '18;0.5;RELEASE',
      // Right hold, doubled instead of halved.
      '18;36;RELEASE',
      // Right rate, wrong action.
      '18;9;VENT',
    ]) {
      const r = await adapter.submit(5, bad);
      expect(r.verified, `actuation ${bad} must be refused`).toBe(false);
    }
    expect(adapter.allSolved()).toBe(false);

    const good = await adapter.submit(5, correctSubmission(5));
    expect(good.verified).toBe(true);
    expect(adapter.allSolved()).toBe(true);
  });
});

describe('refresh and reconnection', () => {
  beforeEach(() => {
    localStorage.clear();
    setSearch('?mock=1');
  });

  it('restores verified progress after a refresh, and no more than that', async () => {
    const first = createMockAdapter();
    await first.init();
    await first.submit(1, correctSubmission(1));
    await first.submit(2, correctSubmission(2));
    expect(first.solvedPuzzles()).toEqual([1, 2]);

    // Simulate a page refresh: a brand-new adapter over the same storage.
    const second = createMockAdapter();
    expect(await second.init()).toBe('ready');
    expect(second.solvedPuzzles()).toEqual([1, 2]);
    expect(unlockedFrom(second)).toBe(3);
    expect(second.allSolved()).toBe(false);
  });

  it('a check() records an attempt without solving the puzzle', async () => {
    const adapter = createMockAdapter();
    await adapter.init();
    const r = await adapter.check(1, '417');
    expect(r.reachedServer).toBe(true);
    expect(r.verified).toBe(true);
    // Verified, but deliberately NOT marked solved.
    expect(adapter.solvedPuzzles()).toEqual([]);
    expect(unlockedFrom(adapter)).toBe(1);
  });
});

describe('Escapp outages never produce false completion', () => {
  beforeEach(() => localStorage.clear());

  it('a submission that cannot reach Escapp is not verified and grants nothing', async () => {
    setSearch('?mock=1&escappFail=1');
    const adapter = createMockAdapter();
    await adapter.init();

    const r = await adapter.submit(1, '417'); // the CORRECT answer
    expect(r.reachedServer).toBe(false);
    expect(r.verified).toBe(false);
    expect(r.error).toMatch(/unreachable/i);
    // The right answer during an outage must still not unlock anything.
    expect(adapter.solvedPuzzles()).toEqual([]);
    expect(unlockedFrom(adapter)).toBe(1);
    expect(adapter.status()).toBe('offline');
  });

  it('a client that never connects reports offline rather than ready', async () => {
    setSearch('?mock=1&escappOffline=1');
    const adapter = createMockAdapter();
    expect(await adapter.init()).toBe('offline');
    expect(adapter.status()).toBe('offline');
    expect(adapter.allSolved()).toBe(false);
  });

  it('an outage mid-run preserves the progress already verified', async () => {
    setSearch('?mock=1');
    const online = createMockAdapter();
    await online.init();
    await online.submit(1, correctSubmission(1));
    await online.submit(2, correctSubmission(2));

    // The uplink drops; a fresh adapter comes up in failing mode.
    setSearch('?mock=1&escappFail=1');
    const degraded = createMockAdapter();
    await degraded.init();
    expect(degraded.solvedPuzzles()).toEqual([1, 2]);
    expect(unlockedFrom(degraded)).toBe(3);

    // Correct stage-3 answer during the outage changes nothing.
    const r = await degraded.submit(3, correctSubmission(3));
    expect(r.verified).toBe(false);
    expect(unlockedFrom(degraded)).toBe(3);
  });
});

describe('the mock adapter is unmistakably a mock', () => {
  it('declares isMock so the UI can label simulated verification', async () => {
    setSearch('?mock=1');
    const adapter = createMockAdapter();
    expect(adapter.isMock).toBe(true);
    const r = await adapter.submit(1, 'wrong');
    expect(r.verified).toBe(false);
  });
});

describe('server-faithful solution matching', () => {
  beforeEach(() => {
    localStorage.clear();
    setSearch('?mock=1');
  });

  /**
   * Escapp compares solutions case-insensitively, after trimming and stripping
   * diacritics. The mock must be no stricter, or a local run could reject an
   * answer the real server would accept.
   */
  it('accepts the same variations the Escapp server accepts', async () => {
    const adapter = createMockAdapter();
    await adapter.init();
    for (const variant of ['417', ' 417 ', '417\n']) {
      localStorage.clear();
      const a = createMockAdapter();
      await a.init();
      const r = await a.submit(1, variant);
      expect(r.verified, `"${variant}" should be accepted`).toBe(true);
    }
    // Case-insensitive on the word tokens.
    await adapter.submit(1, '417');
    await adapter.submit(2, correctSubmission(2));
    for (const variant of ['MAINTAIN', 'maintain', 'Maintain', '  maintain  ']) {
      localStorage.clear();
      const a = createMockAdapter();
      await a.init();
      await a.submit(1, '417');
      await a.submit(2, correctSubmission(2));
      const r = await a.submit(3, variant);
      expect(r.verified, `"${variant}" should be accepted`).toBe(true);
    }
  });

  it('still rejects genuinely different answers', async () => {
    const adapter = createMockAdapter();
    await adapter.init();
    for (const bad of ['4 1 7', '41-7', 'four one seven', '']) {
      const r = await adapter.submit(1, bad);
      expect(r.verified, `"${bad}" must be rejected`).toBe(false);
    }
  });
});
