/**
 * A verified stage must always offer a way out.
 *
 * This is the regression test for a bug that broke team play. The proceed bar
 * took a `ready` flag, and stages computed it from LOCAL state: stage 2 used
 * `pumpRunning && meets`, stage 1 used `hasCard`. A teammate who received the
 * progress over Escapp's websocket had built none of that local state, so they
 * saw "✓ Verified" with no button and no way to reach the next stage. Their
 * team had finished the stage and they were stranded in it.
 *
 * `ready` is advisory now. These tests pin that down, because the failure is
 * invisible to typechecking and only shows up with two people playing.
 *
 * @vitest-environment jsdom
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProceedBar } from '../src/components/ProceedBar';
import { SceneStrip } from '../src/components/SceneStrip';
import { Toast } from '../src/components/Toast';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const render = async (props: Parameters<typeof ProceedBar>[0]) => {
  await act(async () => {
    root = createRoot(container);
    root.render(<ProceedBar {...props} />);
  });
};

const base = {
  label: 'Proceed to thermal monitoring',
  waitingLabel: 'Something is unfinished here.',
  onProceed: () => {},
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container.remove();
});

describe('a verified stage always offers a way forward', () => {
  /** The exact state a teammate lands in: verified, but no local progress. */
  it('offers an enabled button when verified but not locally ready', async () => {
    await render({ ...base, verified: true, ready: false });
    const button = container.querySelector('button');
    expect(button, 'a verified stage with no local state must still have a button').not.toBeNull();
    expect(button!.disabled).toBe(false);
    expect(button!.textContent).toContain('Proceed to thermal monitoring');
  });

  it('offers the button when verified and ready', async () => {
    await render({ ...base, verified: true, ready: true });
    expect(container.querySelector('button')).not.toBeNull();
    expect(container.querySelector('button')!.disabled).toBe(false);
  });

  it('actually advances when clicked in the teammate case', async () => {
    const onProceed = vi.fn();
    await render({ ...base, verified: true, ready: false, onProceed });
    await act(async () => {
      container.querySelector('button')!.click();
    });
    expect(onProceed).toHaveBeenCalledTimes(1);
  });

  it('shows nothing at all before the stage is verified', async () => {
    for (const ready of [true, false]) {
      await render({ ...base, verified: false, ready });
      expect(container.querySelector('button')).toBeNull();
      expect(container.textContent).toBe('');
      await act(async () => root.unmount());
    }
  });
});

describe('the waiting label is advice, not a condition', () => {
  it('appears alongside the button rather than replacing it', async () => {
    await render({ ...base, verified: true, ready: false });
    expect(container.textContent).toContain('Something is unfinished here.');
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('is replaced by the saved message once ready', async () => {
    await render({ ...base, verified: true, ready: true });
    expect(container.textContent).toContain('Progress saved');
    expect(container.textContent).not.toContain('Something is unfinished here.');
  });

  it('falls back gracefully when no waiting label is given', async () => {
    await render({ verified: true, ready: false, label: 'Go', onProceed: () => {} });
    expect(container.querySelector('button')).not.toBeNull();
    expect(container.textContent).toContain('Progress saved');
  });
});

/**
 * The other half of the same bug.
 *
 * Even with `ready` made advisory, every stage rendered the message and the
 * proceed bar as alternatives: `{toast && <Toast/>}{!toast && <ProceedBar/>}`.
 * A confirmation about the stage therefore HID the control that leaves it, and
 * because a pointer resting on a toast pauses its countdown, "until the
 * message clears" could be indefinite. They have separate rows now.
 */
describe('a message never hides the way forward', () => {
  it('shows the proceed button while a message is on the strip', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <SceneStrip>
          <Toast
            data={{ tone: 'ok', title: 'CABINET OPEN', body: 'The latch retracts.' }}
            onClose={() => {}}
          />
          <ProceedBar {...base} verified ready={false} />
        </SceneStrip>,
      );
    });

    expect(container.querySelector('.toast')).not.toBeNull();
    const button = container.querySelector('.proceed button') as HTMLButtonElement | null;
    expect(button, 'the proceed control must survive a message').not.toBeNull();
    expect(button!.disabled).toBe(false);
  });

  it('still shows nothing for an unverified stage, message or not', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <SceneStrip>
          <Toast
            data={{ tone: 'bad', title: 'ACCESS DENIED', body: 'The reader stays red.' }}
            onClose={() => {}}
          />
          <ProceedBar {...base} verified={false} ready={false} />
        </SceneStrip>,
      );
    });

    expect(container.querySelector('.toast')).not.toBeNull();
    expect(container.querySelector('.proceed')).toBeNull();
  });
});
