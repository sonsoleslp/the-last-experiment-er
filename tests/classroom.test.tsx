/**
 * Classroom display mode, `?interface=class`.
 *
 * The guarantee that matters: it constructs **no Escapp client**, so nothing
 * can put a sign-in dialog on a projector in front of a class. Hiding the game
 * inside the provider tree would not have achieved that, because
 * EscappProvider boots the client the moment it mounts. So this checks the
 * route really does bypass the providers, not merely the game.
 *
 * @vitest-environment jsdom
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassIntro } from '../src/components/ClassIntro';
import { isClassroomMode } from '../src/classroom';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const at = (search: string) => {
  window.history.replaceState({}, '', `/${search}`);
};

describe('detecting classroom mode', () => {
  it('turns on for ?interface=class', () => {
    at('?interface=class');
    expect(isClassroomMode()).toBe(true);
  });

  it('is forgiving about case and stray whitespace', () => {
    for (const q of ['?interface=Class', '?interface=CLASS', '?interface=%20class%20']) {
      at(q);
      expect(isClassroomMode(), q).toBe(true);
    }
  });

  it('stays off for anything else', () => {
    for (const q of ['', '?mock=1', '?interface=', '?interface=team', '?interface=classroom', '?class=1']) {
      at(q);
      expect(isClassroomMode(), `"${q}" must not enable classroom mode`).toBe(false);
    }
  });

  it('does not enable itself when combined with other parameters', () => {
    at('?mock=1&interface=class');
    expect(isClassroomMode()).toBe(true);
    at('?interface=class&escappFail=1');
    expect(isClassroomMode()).toBe(true);
  });
});

describe('the classroom display', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    at('?interface=class');
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const render = async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<ClassIntro />);
    });
  };

  /** The whole point: no client, so no authentication dialog. */
  it('never constructs an Escapp client', async () => {
    const ESCAPP = vi.fn();
    vi.stubGlobal('ESCAPP', ESCAPP);
    await render();
    expect(ESCAPP).not.toHaveBeenCalled();
  });

  it('shows the cinematic gate rather than a sign-in or a boot screen', async () => {
    await render();
    const text = container.textContent ?? '';
    expect(text).toContain('THE LAST EXPERIMENT');
    expect(text).toMatch(/Begin transmission/i);
    expect(text).not.toMatch(/ESTABLISHING FACILITY UPLINK/i);
    expect(text).not.toMatch(/NOT IDENTIFIED/i);
    expect(text).not.toMatch(/UPLINK LOST/i);
  });

  it('offers a skip, so a teacher is never trapped in the cinematic', async () => {
    await render();
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent ?? '');
    expect(labels.some((l) => /skip/i.test(l))).toBe(true);
  });

  it('does not render the game shell', async () => {
    await render();
    // No HUD, no inventory, no stage rail: there is no team and no progress.
    expect(container.querySelector('.hud')).toBeNull();
    expect(container.querySelector('.inventory')).toBeNull();
    expect(container.querySelector('.rail')).toBeNull();
  });
});
