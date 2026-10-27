/**
 * The platform must not appear in the fiction.
 *
 * A student in the middle of a rescue should never read the word "Escapp" in a
 * facility warning, a debrief or a progress message. It is allowed in the
 * banners meant for whoever is RUNNING the room, where naming the platform is
 * the actionable information: simulated mode, author preview, and the
 * setup-problem banner.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stageSolvedToast } from '../src/game/notifications';
import { DOCUMENTS } from '../src/game/documents';
import { INTRO_BEATS } from '../src/game/intro';

/** Files whose player-facing strings are pure fiction. */
const NARRATIVE_FILES = [
  'src/game/documents.ts',
  'src/game/notifications.ts',
  'src/game/intro.ts',
  'src/components/ProceedBar.tsx',
  'src/components/IdCard.tsx',
  'src/components/Toast.tsx',
  ...readdirSync('src/stages').map((f) => `src/stages/${f}`),
];

/** Strip comments, so the rule is about what is shown, not what is explained. */
const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    // Imports and type names legitimately contain the word.
    .replace(/^\s*import[\s\S]*?from\s+'[^']*';$/gm, '')
    .replace(/\bEscapp(Provider|Status|Adapter|Storage|Client|ClientSettings)\b/g, '')
    .replace(/\buseEscapp\b|\bESCAPP_[A-Z_]+\b|\bescapp\/[\w.]+/g, '');

describe('the fiction does not name the platform', () => {
  for (const path of NARRATIVE_FILES) {
    it(`${path} is clean`, () => {
      const hits = code(path)
        .split('\n')
        .map((l, i) => [i + 1, l] as const)
        .filter(([, l]) => /escapp/i.test(l));
      expect(hits.map(([n, l]) => `${n}: ${l.trim()}`)).toEqual([]);
    });
  }
});

describe('the content itself is clean', () => {
  it('no recovered document mentions it', () => {
    for (const d of DOCUMENTS) {
      expect(`${d.title} ${d.source} ${d.body.join(' ')}`).not.toMatch(/escapp/i);
    }
  });

  it('no stage-solved notification mentions it', () => {
    for (const stage of [1, 2, 3, 4, 5]) {
      const t = stageSolvedToast(stage);
      expect(`${t?.title} ${t?.body}`).not.toMatch(/escapp/i);
    }
  });

  it('no intro caption mentions it', () => {
    for (const b of INTRO_BEATS) {
      expect(b.caption).not.toMatch(/escapp/i);
    }
  });

  it('the hint text for students does not mention it either', () => {
    const hints = readFileSync('guides/ESCAPP_HINTS.md', 'utf8')
      .split('\n')
      .filter((l) => l.startsWith('> '))
      .join(' ');
    expect(hints).not.toMatch(/escapp/i);
  });
});
