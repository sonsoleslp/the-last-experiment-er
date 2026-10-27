/**
 * Escapp puzzle wiring for THE LAST EXPERIMENT.
 *
 * The app sends the player's ACTUAL decision to Escapp, which verifies it
 * against the solution configured for each puzzle in the Escapp authoring UI.
 * Escapp; not this app: is the authority on whether a stage is complete.
 *
 * Configure these five solutions in your escape room exactly as listed in the
 * `solution` fields below. See guides/ESCAPP_SETUP.md.
 *
 * Note that every solution is a value the players genuinely established:
 * a badge number they found, a machine setting they calibrated, an
 * intervention they chose, the release window they computed. None of them is
 * an arbitrary password invented to carry a number.
 */

export const STAGE_PUZZLE_IDS = [1, 2, 3, 4, 5] as const;
export type PuzzleId = (typeof STAGE_PUZZLE_IDS)[number];

export interface PuzzleSpec {
  id: PuzzleId;
  stage: number;
  title: string;
  /** Exact string to configure as this puzzle's solution in Escapp. */
  solution: string;
  /** What the submitted string means, for the teacher guide. */
  meaning: string;
}

export const PUZZLES: PuzzleSpec[] = [
  {
    id: 1,
    stage: 1,
    title: 'The Locked Laboratory',
    solution: '417',
    meaning: 'The employee badge number found in the desk, used on the cabinet lock.',
  },
  {
    id: 2,
    stage: 2,
    title: 'Restore the Cooling System',
    solution: '3',
    meaning:
      'The pump regulator setting that maximises Q(x) = -2x^2 + 12x + 5 and so is the only setting reaching 22 L/min.',
  },
  {
    id: 3,
    stage: 3,
    title: 'The Temperature Crisis',
    solution: 'MAINTAIN',
    meaning:
      "The intervention chosen. T'(2) = -4 deg C/min < 0, so the chamber is cooling and cooling must be maintained.",
  },
  {
    id: 4,
    stage: 4,
    title: 'The Rescue Window',
    solution: '3;15;-2',
    meaning:
      "The authorised release minute with the temperature and rate of change that justify it: t = 3, T(3) = 15 deg C, T'(3) = -2 deg C/min.",
  },
  {
    id: 5,
    stage: 5,
    title: 'Emergency Release',
    solution: '18;9;RELEASE',
    meaning:
      'The final step: the pressure on the gauge, how fast it is falling (half of 18, measured by building a tangent on the pressure curve), and the action taken. Reaching this needs two vent bursts, because after the first the pressure is still falling too fast to open the door safely.',
  },
];

export const puzzleForStage = (stage: number): PuzzleSpec => {
  const spec = PUZZLES.find((p) => p.stage === stage);
  if (!spec) throw new Error(`No Escapp puzzle configured for stage ${stage}`);
  return spec;
};

export const LAST_PUZZLE_ID = PUZZLES[PUZZLES.length - 1].id;

/**
 * Settings for `new window.ESCAPP(...)`.
 *
 * `endpoint` is intentionally absent: the Escapp server injects it via
 * window.ESCAPP_APP_SETTINGS.escappClientSettings in production, and
 * vite.config.ts injects it from config.mjs in local development. Never
 * hard-code an endpoint or any credential here; this file ships to the
 * browser.
 */
export const ESCAPP_CLIENT_SETTINGS = {
  imagesPath: './images/',
  linkedPuzzleIds: [...STAGE_PUZZLE_IDS] as number[],

  /*
   * How the client handles team progress arriving from someone else.
   *
   *   NEVER              ignore team progress entirely
   *   AUTO               adopt it and tell the app, with no dialog   <-- ours
   *   AUTO_NOTIFICATION  adopt it, but show a modal dialog first
   *   REQUEST_USER       ask, with OK / Cancel
   *
   * AUTO is chosen because the APP provides the notification, not the client.
   * A teammate now sees the very same message the solver saw (see
   * game/notifications.ts), in the same place, and is moved on once they have
   * read it. The client's own dialog would have been a different, modal
   * message interrupting them, which is not the same experience at all.
   *
   * AUTO on its own would be abrupt, so the gentleness lives in the app: see
   * game/progression.ts, which never moves a player without first showing the
   * stage-solved notification.
   *
   * Note: preview mode forces this to NEVER, so it only takes effect for real
   * participant play.
   */
  restoreState: 'AUTO' as const,
};
