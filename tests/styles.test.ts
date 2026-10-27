/**
 * Every className in the app must have a CSS rule behind it.
 *
 * This exists because of a real bug that shipped twice. A bulk vocabulary
 * rewrite ("interlock" -> "safety lock", "detent" -> "click position") was
 * applied to string literals without distinguishing prose from code, so it
 * rewrote class NAMES as well:
 *
 *   className="dial-detent"     ->  className="dial-click position"
 *   className="interlock-row"   ->  className="safety lock-row"
 *   className="interlock-text"  ->  className="safety lock-text"
 *
 * Those elements then had no styling at all and fell back to inherited white
 * text on no background. The pump dial numbers were invisible, and the
 * document lists in all three binders silently lost their layout. TypeScript
 * cannot catch this, because a className is just a string.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

const files = walk('src');

/** Class selectors defined anywhere in the stylesheets. */
const definedClasses = (): Set<string> => {
  const css = files
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  return new Set(Array.from(css.matchAll(/\.([a-zA-Z][\w-]*)/g), (m) => m[1]));
};

/** Classes referenced from className attributes, with where they came from. */
const usedClasses = (): Map<string, string[]> => {
  const used = new Map<string, string[]>();
  for (const f of files.filter((n) => n.endsWith('.tsx'))) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const raw = (m[1] ?? m[2] ?? '').replace(/\$\{[^}]*\}/g, ' ');
      for (const cls of raw.split(/\s+/).filter(Boolean)) {
        used.set(cls, [...(used.get(cls) ?? []), f]);
      }
    }
  }
  return used;
};

describe('CSS classes', () => {
  it('every className used in a component is defined in the stylesheets', () => {
    const defined = definedClasses();
    const orphans = [...usedClasses().entries()]
      .filter(([cls]) => !defined.has(cls))
      .map(([cls, where]) => `${cls} (used in ${[...new Set(where)].join(', ')})`);
    expect(orphans, `classNames with no CSS rule:\n  ${orphans.join('\n  ')}`).toEqual([]);
  });

  /**
   * The specific names the vocabulary pass destroyed. Spelled out so that if
   * anyone renames them deliberately, this test tells them what else to check.
   */
  it('the classes that were broken before are still present', () => {
    const defined = definedClasses();
    for (const cls of ['dial-detent', 'interlock-row', 'interlock-text']) {
      expect(defined.has(cls), `${cls} must be defined in CSS`).toBe(true);
    }
    const used = usedClasses();
    expect(used.has('dial-detent')).toBe(true);
    expect(used.has('interlock-row')).toBe(true);
  });

  it('no className contains a space-separated fragment that looks like prose', () => {
    // "safety lock-row" and "dial-click position" both slipped through as
    // two classes where one was intended.
    for (const cls of usedClasses().keys()) {
      expect(cls, `suspicious class name: ${cls}`).not.toMatch(/^(safety|position|lock)$/);
    }
  });
});

describe('the dial is actually visible', () => {
  it('sets an explicit colour and background, not inherited text', () => {
    const css = readFileSync('src/styles/components.css', 'utf8');
    const rule = css.slice(css.indexOf('.dial-detent {'), css.indexOf('.dial-detent:hover'));
    expect(rule).toMatch(/color:/);
    expect(rule).toMatch(/background:/);
    expect(rule).toMatch(/border:/);
  });
});
