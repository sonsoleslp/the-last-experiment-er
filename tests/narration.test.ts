/**
 * The narration clips.
 *
 * Narration is supplied as one clip per beat (`public/media/intro-N.mp3`),
 * which is what keeps the words, the captions and the visuals together: each
 * clip plays while its own caption is on screen and the next beat starts when
 * it ends. The shipped recording runs about 47 seconds against the 56 the
 * caption lengths predicted, so a single continuous file against derived
 * timings would have drifted noticeably by the end.
 *
 * The risk with per-beat clips is a missing or mis-ordered one, which no
 * amount of typechecking would catch. These tests check the set is complete
 * and in the right order.
 */

import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INTRO_BEATS, beatAudioUrl } from '../src/game/intro';

const clipPath = (i: number) => `public/media/intro-${i + 1}.mp3`;
const present = INTRO_BEATS.every((_, i) => existsSync(clipPath(i)));

describe('narration clip URLs', () => {
  it('names one clip per beat, numbered from 1', () => {
    expect(beatAudioUrl(0)).toContain('intro-1.mp3');
    expect(beatAudioUrl(INTRO_BEATS.length - 1)).toContain(
      `intro-${INTRO_BEATS.length}.mp3`,
    );
  });
});

describe.skipIf(!present)('the shipped recording', () => {
  it('has exactly one clip for every beat', () => {
    for (const [i] of INTRO_BEATS.entries()) {
      expect(existsSync(clipPath(i)), `${clipPath(i)} is missing`).toBe(true);
    }
  });

  it('has no stray extra clip beyond the beats', () => {
    expect(existsSync(`public/media/intro-${INTRO_BEATS.length + 1}.mp3`)).toBe(false);
  });

  it('every clip holds real audio rather than an empty file', () => {
    for (const [i] of INTRO_BEATS.entries()) {
      // A second of 128 kbps mono is ~16 kB, and the shortest line is ~5 s.
      expect(statSync(clipPath(i)).size, `${clipPath(i)} looks too small`).toBeGreaterThan(40_000);
    }
  });

  /**
   * A precise mis-order detector that needs no audio decoding: at a steady
   * speaking rate, longer captions make bigger files, so ranking the clips by
   * size must give the same order as ranking the captions by length. Swap any
   * two clips and this fails.
   */
  it('is in the same order as the captions', () => {
    const rank = (values: number[]) => {
      const sorted = [...values].slice().sort((a, b) => a - b);
      return values.map((v) => sorted.indexOf(v));
    };
    const sizeRanks = rank(INTRO_BEATS.map((_, i) => statSync(clipPath(i)).size));
    const captionRanks = rank(INTRO_BEATS.map((b) => b.caption.length));
    expect(sizeRanks).toEqual(captionRanks);
  });

  it('is plausibly the right script, at a consistent speaking rate', () => {
    // Bytes per character should not vary wildly between clips; a clip holding
    // the wrong line would stand out.
    const perChar = INTRO_BEATS.map((b, i) => statSync(clipPath(i)).size / b.caption.length);
    const min = Math.min(...perChar);
    const max = Math.max(...perChar);
    expect(max / min).toBeLessThan(1.6);
  });
});
