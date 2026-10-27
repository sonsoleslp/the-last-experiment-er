/**
 * The Escapp hint text.
 *
 * Hints are configured in Escapp rather than in the app, so guides/ESCAPP_HINTS.md
 * is the source a teacher pastes from. That makes it worth checking: a hint
 * that leaks an answer quietly destroys the stage it belongs to, and nothing
 * else in the build would notice.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const raw = readFileSync('guides/ESCAPP_HINTS.md', 'utf8');
/** Markdown hard-wraps at 80 columns, so phrases span newlines. */
const doc = raw.replace(/\s+/g, ' ');

/** Just the quoted hint text, not the surrounding instructions. */
const hintLines = raw
  .split('\n')
  .filter((l) => l.startsWith('> '))
  .map((l) => l.slice(2).trim())
  .join(' ');

/** Hint blocks per puzzle, in order. */
const puzzleSections = raw
  .split(/^## Puzzle /m)
  .slice(1)
  .map((s) => s.split('\n').filter((l) => l.startsWith('**Hint')).length);

describe('hint structure', () => {
  it('covers all five puzzles', () => {
    expect(puzzleSections).toHaveLength(5);
  });

  it('gives exactly three hints per puzzle', () => {
    for (const [i, count] of puzzleSections.entries()) {
      expect(count, `puzzle ${i + 1} should have 3 hints`).toBe(3);
    }
  });

  it('says plainly that hints belong in Escapp, not the app', () => {
    expect(doc).toMatch(/live in \*\*Escapp\*\*/);
    expect(doc).toMatch(/no hint API/);
  });
});

describe('no hint gives an answer away', () => {
  /** The decisive values a team is meant to work out for themselves. */
  const answers: [string, RegExp][] = [
    ['stage 1 badge number', /\b417\b/],
    ['stage 2 dial setting', /\bsetting 3\b|\bx = 3\b/],
    ['stage 2 peak flow', /\b23\b/],
    ['stage 3 rate', /-\s?4\s?°?C|\bminus four\b/],
    ['stage 3 chord trap value', /-\s?6\s?°?C/],
    ['stage 4 release time', /\bt = 3\b|\bminute 3\b|\bminute three\b/],
    ['stage 5 hold pressure', /\b22 kPa\b/],
    ['stage 5 gradient', /\b-?11\b/],
    ['stage 5 unsafe gradient', /\b-?17\b/],
  ];

  for (const [what, pattern] of answers) {
    it(`does not reveal the ${what}`, () => {
      expect(hintLines).not.toMatch(pattern);
    });
  }

  it('does not quote the numeric thresholds either', () => {
    // Naming "22 L/min" or "12 kPa/min" would shortcut reading the documents.
    expect(hintLines).not.toMatch(/\b22 L\/min\b/);
    expect(hintLines).not.toMatch(/\b12 kPa\b/);
    expect(hintLines).not.toMatch(/\b15 ?°C\b/);
    expect(hintLines).not.toMatch(/\b3\.5\b/);
  });

  it('still teaches: each hint set names its idea', () => {
    expect(hintLines).toMatch(/rate of change/i);
    expect(hintLines).toMatch(/average/i);
    expect(hintLines).toMatch(/tangent/i);
    expect(hintLines).toMatch(/inequality/i);
  });
});
