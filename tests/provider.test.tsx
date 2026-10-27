/**
 * EscappProvider boot lifecycle.
 *
 * Regression test for a real bug: under React 18 StrictMode the provider's
 * boot effect ran twice (run → cleanup → run) and an "already booted" guard
 * made the second run bail out, so the first run's init() result was discarded
 * by its own cleanup flag. The status never left 'connecting' and the app hung
 * on "ESTABLISHING FACILITY UPLINK".
 *
 * These tests render the provider for real, in StrictMode, exactly as
 * main.tsx does.
 *
 * @vitest-environment jsdom
 */

import { StrictMode, useEffect } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { EscappProvider, useEscapp } from '../src/escapp/EscappProvider';

// React 18's act() wants this flag set.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Records every status the provider reports, in order. */
const Probe = ({ onStatus }: { onStatus: (s: string) => void }) => {
  const { status, unlockedStage, isMock } = useEscapp();
  useEffect(() => {
    onStatus(`${status}|stage${unlockedStage}|mock:${isMock}`);
  }, [status, unlockedStage, isMock, onStatus]);
  return null;
};

const mountProvider = async (search: string) => {
  window.history.replaceState({}, '', `/${search}`);
  const seen: string[] = [];
  const container = document.createElement('div');
  document.body.appendChild(container);

  let root: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(
      <StrictMode>
        <EscappProvider>
          <Probe onStatus={(s) => seen.push(s)} />
        </EscappProvider>
      </StrictMode>,
    );
  });

  // Let the adapter's simulated latency settle.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
  });

  return { seen, unmount: () => act(async () => root!.unmount()) };
};

describe('EscappProvider boot under StrictMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('leaves the connecting state — the double-mount must not discard init()', async () => {
    const { seen, unmount } = await mountProvider('?mock=1');

    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0]).toContain('connecting');

    const final = seen[seen.length - 1];
    expect(final).toContain('ready');
    // The specific regression: never stuck on connecting.
    expect(final).not.toContain('connecting');
    await unmount();
  });

  it('reports the mock adapter so the UI can label it SIMULATED', async () => {
    const { seen, unmount } = await mountProvider('?mock=1');
    expect(seen[seen.length - 1]).toContain('mock:true');
    await unmount();
  });

  it('starts an un-progressed team at stage 1', async () => {
    const { seen, unmount } = await mountProvider('?mock=1');
    expect(seen[seen.length - 1]).toContain('stage1');
    await unmount();
  });

  it('reaches offline — not a permanent connecting state — when the client never connects', async () => {
    const { seen, unmount } = await mountProvider('?mock=1&escappOffline=1');
    const final = seen[seen.length - 1];
    expect(final).toContain('offline');
    expect(final).not.toContain('connecting');
    await unmount();
  });

  it('restores previously verified progress on a fresh mount (refresh)', async () => {
    // Seed storage the way a completed stage 1+2 would leave it.
    const first = await mountProvider('?mock=1');
    await first.unmount();

    const { createMockAdapter } = await import('../src/escapp/mockAdapter');
    const seeder = createMockAdapter();
    await seeder.init();
    await seeder.submit(1, '417');
    await seeder.submit(2, '3');

    const { seen, unmount } = await mountProvider('?mock=1');
    expect(seen[seen.length - 1]).toContain('stage3');
    await unmount();
  });
});

describe('verified progress drives the scene', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  /**
   * The refresh bug, as a regression test. The viewed stage used to be
   * clamped (`Math.min(Math.max(s, 1), unlocked)`) rather than followed, so a
   * reload started viewStage at 1, the clamp left it at 1, and a team four
   * stages in was dumped back into the dark laboratory.
   */
  it('a reload reports the stage matching the team’s verified progress', async () => {
    const { createMockAdapter } = await import('../src/escapp/mockAdapter');
    const seeder = createMockAdapter();
    await seeder.init();
    await seeder.submit(1, '417');
    await seeder.submit(2, '3');
    await seeder.submit(3, 'MAINTAIN');

    const { seen, unmount } = await mountProvider('?mock=1');
    // Stage 4 is where the team actually is, not stage 1.
    expect(seen[seen.length - 1]).toContain('stage4');
    await unmount();
  });

  it('reports every stage boundary correctly after a reload', async () => {
    const { createMockAdapter } = await import('../src/escapp/mockAdapter');
    const answers = ['417', '3', 'MAINTAIN', '3;15;-2'];
    for (let solved = 0; solved <= answers.length; solved += 1) {
      localStorage.clear();
      const seeder = createMockAdapter();
      await seeder.init();
      for (let i = 0; i < solved; i += 1) await seeder.submit(i + 1, answers[i]);

      const { seen, unmount } = await mountProvider('?mock=1');
      expect(seen[seen.length - 1], `${solved} solved`).toContain(`stage${solved + 1}`);
      await unmount();
    }
  });
});
