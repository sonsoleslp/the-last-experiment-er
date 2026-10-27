/**
 * What to do when the team's verified progress changes.
 *
 * Pulled out as a pure function so the behaviour can be tested directly. It
 * decides two things: which notification to show, and whether to move this
 * player's view.
 *
 * The rule, which is what keeps synchronisation from being abrupt:
 *
 *  - FIRST LOAD. No notification. Put the player straight into the scene their
 *    team's verified progress corresponds to, so a refresh resumes where they
 *    were rather than at stage 1.
 *
 *  - A STAGE GETS VERIFIED while playing. Always show the stage-solved
 *    notification, the same one the solver sees. Then:
 *      * if this player is standing on the stage that was just solved, leave
 *        them there. They get the notification and the "proceed" control, so
 *        they move on when they are ready. This covers the solver and anyone
 *        in the same room as them.
 *      * otherwise they are behind their team, so move them up once the
 *        notification has been read.
 *
 * Nothing here jumps anybody the instant a message arrives, and no player is
 * ever moved without first being told why.
 */

export interface ProgressChange {
  /** Previous unlocked stage, or null on first load. */
  previousUnlocked: number | null;
  /** The newly unlocked stage, derived from Escapp's verified list. */
  unlocked: number;
  /** The stage this player is currently looking at. */
  viewStage: number;
}

export interface ProgressDecision {
  /** Stage whose solved notification to show, or null for none. */
  notifyStage: number | null;
  /** Stage to move to immediately, or null to stay put. */
  jumpTo: number | null;
  /** Stage to move to once the notification clears, or null to stay put. */
  advanceAfterNotice: number | null;
}

export const decideProgress = ({
  previousUnlocked,
  unlocked,
  viewStage,
}: ProgressChange): ProgressDecision => {
  // First load: resume silently at the team's current stage.
  if (previousUnlocked === null) {
    return { notifyStage: null, jumpTo: unlocked, advanceAfterNotice: null };
  }

  // Nothing new. Only clamp if somehow ahead of what is verified.
  if (unlocked <= previousUnlocked) {
    return {
      notifyStage: null,
      jumpTo: viewStage > unlocked ? unlocked : null,
      advanceAfterNotice: null,
    };
  }

  // A stage was verified. The one that was solved is the one just passed.
  const solved = unlocked - 1;
  const standingOnIt = viewStage === solved;

  return {
    notifyStage: solved,
    jumpTo: null,
    // Standing on it: the proceed control takes over, so do not move them.
    advanceAfterNotice: standingOnIt ? null : unlocked,
  };
};
