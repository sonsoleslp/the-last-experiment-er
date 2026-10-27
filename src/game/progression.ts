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
 *      * if this player SOLVED it and is still in that room, leave them
 *        there. They get the notification and the proceed control, so they
 *        move on when they are ready.
 *      * everyone else follows their team once the notification has been
 *        read, including a teammate standing in the same room. They have
 *        nothing left to do there, and making them click to follow their own
 *        team is friction for nothing.
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
  /**
   * Did THIS browser submit the answer for the stage that was just verified?
   *
   * The distinction matters for how helpful the app can be. Someone who just
   * solved the puzzle has business left in the room: watching the coolant
   * settle, picking up the card. Someone whose teammate solved it has none,
   * and making them click to follow their own team is friction for nothing.
   *
   * It is the ATTEMPT that is recorded, not the verdict, because the verdict
   * is not known early enough to be useful here. See EscappProvider.
   */
  attemptedLocally: boolean;
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
  attemptedLocally,
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
  /*
   * Hold position only for the person who solved it, and only while they are
   * still in that room: the proceed control is there for them and they may
   * want a moment. Everyone else follows their team once the notification has
   * been read, including a teammate standing in the same room, who has nothing
   * left to do there.
   */
  const keepPosition = attemptedLocally && viewStage === solved;

  return {
    notifyStage: solved,
    jumpTo: null,
    advanceAfterNotice: keepPosition ? null : unlocked,
  };
};
