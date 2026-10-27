/**
 * The opening narration, as timed beats.
 *
 * Beat start times are DERIVED from caption length rather than written by
 * hand. Hand-written gaps meant a short line like the opening one sat on
 * screen for eight seconds while a long line got thirteen, so the pacing
 * lurched. Each beat now gets a fixed pause plus reading time in step with
 * its own length, which keeps every caption on screen for about as long as it
 * takes to say.
 *
 * It also means editing a caption re-paces the intro automatically, so the
 * script and the code cannot drift apart.
 *
 * The captions are the narration script verbatim. The generated timings are
 * printed in guides/INTRO_SCRIPT.md; in audio mode the captions follow the real
 * audio clock, so a narrator's own pacing wins over these estimates.
 */

/** Speaking rate, characters per second. Unhurried but not slow. */
const CHARS_PER_SECOND = 15;
/** Pause at each beat change, seconds. */
const BEAT_PAUSE = 1.3;

export interface IntroBeat {
  at: number;
  visual: 'facility' | 'failure' | 'chamber' | 'sensor' | 'mission' | 'title';
  caption: string;
}

/** Beats in order, without timings. */
const SCRIPT: Omit<IntroBeat, 'at'>[] = [
  {
    visual: 'facility',
    caption: 'Meridian Research Facility. Sublevel three. Six minutes past two in the afternoon.',
  },
  {
    visual: 'failure',
    caption:
      'The cooling system broke. The building locked itself down, and every door on this floor sealed shut.',
  },
  {
    visual: 'chamber',
    caption:
      'Doctor Elena Vale was inside test chamber C-7 when it closed. She is alive. She has an emergency air tank, and it is measured in minutes.',
  },
  {
    visual: 'sensor',
    caption:
      'The instruments in that chamber are damaged. The safety system can still measure things, but it cannot decide what to do. It will not open the door until someone proves it is safe.',
  },
  {
    visual: 'mission',
    caption:
      'You are the emergency team. Get the coolant flowing. Find out which way the temperature is going. Work out the earliest moment that door can open.',
  },
  {
    visual: 'title',
    caption:
      'The instruments will give you numbers. What those numbers mean is up to you. Go.',
  },
];

/** How long a beat holds, seconds. */
export const beatDuration = (caption: string): number =>
  BEAT_PAUSE + caption.length / CHARS_PER_SECOND;

export const INTRO_BEATS: IntroBeat[] = (() => {
  let t = 0;
  return SCRIPT.map((b) => {
    const beat = { ...b, at: Math.round(t * 10) / 10 };
    t += beatDuration(b.caption);
    return beat;
  });
})();

/** Total runtime, seconds. Used by silent mode and the progress bar. */
export const INTRO_DURATION =
  Math.round(SCRIPT.reduce((sum, b) => sum + beatDuration(b.caption), 0) * 10) / 10;

/**
 * Per-beat narration clips, `public/media/intro-1.mp3` upward, one per beat.
 *
 * This is the preferred way to supply narration, and it is what the shipped
 * recording uses. Each clip plays while its own caption is on screen and the
 * next beat starts when the clip ends, so the words, the captions and the
 * visuals cannot drift apart no matter how the narrator paced it. The derived
 * `at` times below are then only used when there is no audio at all.
 *
 * The shipped recording runs about 47 seconds against the 56 the caption
 * lengths predicted, which is exactly the drift this arrangement avoids.
 */
export const beatAudioUrl = (index: number): string =>
  assetUrl(`media/intro-${index + 1}.mp3`);

/** Short breath between clips, so the visuals have a beat to change on. */
export const BEAT_GAP_MS = 550;

/**
 * Resolve a path inside `public/` against the deployed base.
 *
 * The app is built with a relative base so Escapp can mount it anywhere, so
 * media must be addressed through BASE_URL rather than from the site root.
 */
export const assetUrl = (path: string): string => {
  const base = import.meta.env.BASE_URL || './';
  return `${base.endsWith('/') ? base : `${base}/`}${path}`;
};
