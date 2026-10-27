/**
 * The intro cinematic's motion, and its reduced-motion behaviour.
 *
 * SVG SMIL animation (`<animate>`, `<animateTransform>`) is NOT covered by the
 * CSS `prefers-reduced-motion` rule, so the vignettes have to read the
 * preference in JavaScript and omit the animation elements. That is easy to
 * regress silently, which is why it is tested rather than trusted.
 *
 * @vitest-environment jsdom
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntroVignette, type VignetteBeat } from '../src/components/IntroVignette';
import { INTRO_BEATS, INTRO_DURATION, beatDuration } from '../src/game/intro';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BEATS: VignetteBeat[] = ['facility', 'failure', 'chamber', 'sensor', 'mission', 'title'];

/** Point matchMedia at a fixed answer for prefers-reduced-motion. */
const mockReducedMotion = (reduce: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion') ? reduce : false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
};

let container: HTMLDivElement;
let root: Root;

const render = async (beat: VignetteBeat, active: boolean) => {
  await act(async () => {
    root = createRoot(container);
    root.render(<IntroVignette beat={beat} active={active} />);
  });
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const countAnimations = () =>
  container.querySelectorAll('animate, animateTransform, animateMotion').length;

describe('intro vignettes animate', () => {
  beforeEach(() => mockReducedMotion(false));

  it('every beat has motion once playback starts', async () => {
    for (const beat of BEATS) {
      await render(beat, true);
      expect(countAnimations(), `beat "${beat}" should animate`).toBeGreaterThan(0);
      await act(async () => root.unmount());
    }
  });

  it('stays still before playback begins, so the title card is calm', async () => {
    for (const beat of BEATS) {
      await render(beat, false);
      expect(countAnimations(), `beat "${beat}" should be static when idle`).toBe(0);
      await act(async () => root.unmount());
    }
  });
});

describe('reduced motion is honoured', () => {
  beforeEach(() => mockReducedMotion(true));

  /** The guarantee: no SMIL at all, even mid-playback. */
  it('renders no animation elements on any beat', async () => {
    for (const beat of BEATS) {
      await render(beat, true);
      expect(countAnimations(), `beat "${beat}" must not animate`).toBe(0);
      await act(async () => root.unmount());
    }
  });

  it('still renders the artwork, so nothing is lost by opting out', async () => {
    for (const beat of BEATS) {
      await render(beat, true);
      expect(container.querySelector('svg')).not.toBeNull();
      expect(container.querySelectorAll('svg *').length).toBeGreaterThan(5);
      await act(async () => root.unmount());
    }
  });
});

describe('beats line up with the narration', () => {
  it('every scripted beat has a vignette that exists', () => {
    for (const b of INTRO_BEATS) {
      expect(BEATS).toContain(b.visual);
    }
  });

  it('uses all six vignettes, so none is dead code', () => {
    expect(new Set(INTRO_BEATS.map((b) => b.visual)).size).toBe(BEATS.length);
  });

  it('beat timings are derived from caption length and add up', () => {
    const total = INTRO_BEATS.reduce((sum, b) => sum + beatDuration(b.caption), 0);
    expect(INTRO_DURATION).toBeCloseTo(total, 1);
    for (let i = 1; i < INTRO_BEATS.length; i += 1) {
      expect(INTRO_BEATS[i].at).toBeGreaterThan(INTRO_BEATS[i - 1].at);
    }
  });

  it('no caption lingers much longer than it takes to read', () => {
    // The complaint that started this: a short opening line held for 8s.
    for (const b of INTRO_BEATS) {
      const seconds = beatDuration(b.caption);
      const charsPerSecond = b.caption.length / seconds;
      expect(charsPerSecond).toBeGreaterThan(9);
      expect(seconds).toBeLessThan(15);
    }
  });
});
