/**
 * A stale solution in Escapp must be reported as a setup problem.
 *
 * This exists because of a trap I built. Puzzle 5's solution changed twice
 * while the stage was being redesigned (`3;MAINTAIN;3` -> `21;-8.4;RELEASE` ->
 * `18;9;RELEASE`). If the escape room still has an older value configured,
 * Escapp rejects the one correct answer, the stage becomes impossible, and the
 * message the student used to see was "re-check your tangent reading", which
 * blamed them for someone else's configuration.
 *
 * So: when Escapp refuses the exact string a stage is supposed to submit, that
 * is a configuration mismatch by definition, and it has to be said out loud.
 */

import { describe, expect, it } from 'vitest';
import { PUZZLES, puzzleForStage } from '../src/escapp/puzzles';

/** Mirrors the check in EscappProvider.submitStage. */
const isConfigMismatch = (stage: number, submitted: string, verified: boolean, reached: boolean) =>
  reached && !verified && submitted === puzzleForStage(stage).solution;

describe('detecting a stale configured solution', () => {
  it('flags a rejection of the exact expected answer, for every stage', () => {
    for (const p of PUZZLES) {
      expect(isConfigMismatch(p.stage, p.solution, false, true), `stage ${p.stage}`).toBe(true);
    }
  });

  it('does not flag an ordinary wrong answer', () => {
    expect(isConfigMismatch(5, '22;17;RELEASE', false, true)).toBe(false);
    expect(isConfigMismatch(2, '5', false, true)).toBe(false);
    expect(isConfigMismatch(3, 'SUPPRESSION', false, true)).toBe(false);
  });

  it('does not flag a correct answer that was accepted', () => {
    for (const p of PUZZLES) {
      expect(isConfigMismatch(p.stage, p.solution, true, true)).toBe(false);
    }
  });

  it('does not flag an answer that never reached the server', () => {
    // That is an outage, which has its own message and its own remedy.
    for (const p of PUZZLES) {
      expect(isConfigMismatch(p.stage, p.solution, false, false)).toBe(false);
    }
  });

  /**
   * The superseded values, kept here on purpose: if anyone still has one of
   * these in Escapp, the game submits the current string and the mismatch
   * check is what tells them.
   */
  it('treats the superseded puzzle 5 solutions as plain wrong answers', () => {
    for (const old of ['3;MAINTAIN;3', '21;-8.4;RELEASE', '22;11;RELEASE']) {
      expect(old).not.toBe(puzzleForStage(5).solution);
      expect(isConfigMismatch(5, old, false, true)).toBe(false);
    }
  });

  it('every stage has a non-empty solution to compare against', () => {
    for (const p of PUZZLES) {
      expect(p.solution.trim().length).toBeGreaterThan(0);
    }
  });
});
