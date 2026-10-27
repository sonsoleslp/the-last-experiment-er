/**
 * How team progress reaches a player.
 *
 * The requirement: a teammate must see the SAME notification the solver saw,
 * and must not be moved between scenes until they have read it. Escapp is
 * configured with restoreState 'AUTO' precisely so the client does not put its
 * own modal dialog in the way; the gentleness is the app's job, and that means
 * it has to be tested.
 */

import { describe, expect, it } from 'vitest';
import { decideProgress } from '../src/game/progression';
import { stageSolvedToast } from '../src/game/notifications';
import { PUZZLES } from '../src/escapp/puzzles';

describe('first load', () => {
  it('resumes at the team stage with no notification', () => {
    const d = decideProgress({ previousUnlocked: null, unlocked: 4, viewStage: 1 });
    expect(d.jumpTo).toBe(4);
    expect(d.notifyStage).toBeNull();
    expect(d.advanceAfterNotice).toBeNull();
  });

  it('does not announce progress the player was not present for', () => {
    for (const unlocked of [1, 2, 3, 4, 5]) {
      expect(decideProgress({ previousUnlocked: null, unlocked, viewStage: 1 }).notifyStage).toBeNull();
    }
  });
});

describe('a stage gets verified while playing', () => {
  it('never moves anyone immediately', () => {
    for (const viewStage of [1, 2, 3, 4, 5]) {
      const d = decideProgress({ previousUnlocked: 2, unlocked: 3, viewStage });
      expect(d.jumpTo, `viewStage ${viewStage} must not jump`).toBeNull();
    }
  });

  it('always shows the stage-solved notification first', () => {
    const d = decideProgress({ previousUnlocked: 2, unlocked: 3, viewStage: 1 });
    expect(d.notifyStage).toBe(2);
    expect(d.advanceAfterNotice).toBe(3);
  });

  /** The solver, and anyone standing in the same room, keep their proceed bar. */
  it('leaves a player standing on the solved stage where they are', () => {
    const d = decideProgress({ previousUnlocked: 2, unlocked: 3, viewStage: 2 });
    expect(d.notifyStage).toBe(2);
    expect(d.advanceAfterNotice).toBeNull();
  });

  it('catches up a player who is behind their team, after the notice', () => {
    const d = decideProgress({ previousUnlocked: 2, unlocked: 4, viewStage: 1 });
    expect(d.notifyStage).toBe(3);
    expect(d.advanceAfterNotice).toBe(4);
  });

  it('ignores a state change that advances nothing', () => {
    const d = decideProgress({ previousUnlocked: 3, unlocked: 3, viewStage: 3 });
    expect(d.notifyStage).toBeNull();
    expect(d.advanceAfterNotice).toBeNull();
    expect(d.jumpTo).toBeNull();
  });

  it('clamps a player somehow ahead of what is verified', () => {
    const d = decideProgress({ previousUnlocked: 3, unlocked: 3, viewStage: 5 });
    expect(d.jumpTo).toBe(3);
  });
});

describe('the shared notification', () => {
  it('exists for every stage, so no progress is silent', () => {
    for (const p of PUZZLES) {
      const toast = stageSolvedToast(p.stage);
      expect(toast, `stage ${p.stage} needs a solved notification`).not.toBeNull();
      expect(toast!.tone).toBe('ok');
      expect(toast!.title.length).toBeGreaterThan(3);
      expect(toast!.body.length).toBeGreaterThan(20);
    }
  });

  /**
   * It must be derivable from the model alone, with no local interface state,
   * or a teammate's browser could not produce the solver's wording.
   */
  it('is identical on every call, so every browser agrees', () => {
    for (const p of PUZZLES) {
      expect(stageSolvedToast(p.stage)).toEqual(stageSolvedToast(p.stage));
    }
  });

  it('reports the values the team actually established', () => {
    expect(stageSolvedToast(2)!.body).toContain('23 L/min');
    expect(stageSolvedToast(2)!.body).toContain('setting 3');
    expect(stageSolvedToast(3)!.body).toContain('-4.0');
    expect(stageSolvedToast(4)!.title).toContain('3 MIN');
    expect(stageSolvedToast(5)!.body).toContain('22 kPa');
    expect(stageSolvedToast(5)!.body).toContain('11 kPa/min');
  });

  it('has nothing for a stage that does not exist', () => {
    expect(stageSolvedToast(0)).toBeNull();
    expect(stageSolvedToast(99)).toBeNull();
  });
});
