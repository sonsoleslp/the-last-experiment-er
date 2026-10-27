/**
 * The person who SOLVES a stage must be offered the way forward.
 *
 * Regression test for a bug that stranded the solver of stage 1 while working
 * correctly for their teammates, which is exactly how it was reported: "it
 * shows for the team member but not for one self".
 *
 * Two independent causes, both exercised here by driving the real stage:
 *
 *  1. The solver was misclassified as a teammate. Escapp reports the new team
 *     state through onStateChange, and that callback arrives while
 *     submitStage() is still awaiting its own result. Recording "this browser
 *     solved it" after the await was therefore too late: progression ran first
 *     and saw a teammate, so it carried the solver out of the room instead of
 *     letting them finish in it. The attempt is now recorded before the send.
 *
 *  2. The proceed bar was suppressed whenever a message was on the strip
 *     ({toast && <Toast/>}{!toast && <ProceedBar/>}), so the only control that
 *     leaves a verified room could be hidden by a confirmation about that very
 *     room. They have separate rows now.
 *
 * @vitest-environment jsdom
 */

import { StrictMode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../src/App';
import { EscappProvider } from '../src/escapp/EscappProvider';
import { GameProvider } from '../src/game/GameProvider';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settle = async (ms = 300) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

const buttons = () => Array.from(document.querySelectorAll('button'));
const byText = (text: string) =>
  buttons().find((b) => (b.textContent ?? '').includes(text)) ?? null;

const click = async (el: Element | null, what: string) => {
  if (!el) throw new Error(`nothing to click for "${what}"`);
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await settle(150);
};

const hudText = () => (document.querySelector('.hud')?.textContent ?? '');
const proceedButton = () =>
  document.querySelector('.proceed button') as HTMLButtonElement | null;

let root: Root | null = null;
let container: HTMLDivElement;

/** Mount the real app on the mock adapter and walk stage 1 up to the keypad. */
const openKeypad = async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(
      <StrictMode>
        <EscappProvider>
          <GameProvider>
            <App />
          </GameProvider>
        </EscappProvider>
      </StrictMode>,
    );
  });
  await settle(400);

  await click(byText('Skip intro'), 'skip intro');
  const cabinet = Array.from(document.querySelectorAll('[aria-label]')).find((n) =>
    (n.getAttribute('aria-label') ?? '').startsWith('Storage Cabinet'),
  );
  await click(cabinet ?? null, 'storage cabinet');
};

/** Enter a three-digit code on the cabinet keypad. */
const enterCode = async (code: string) => {
  for (const d of code) {
    await click(
      buttons().find((b) => (b.textContent ?? '').trim() === d) ?? null,
      `digit ${d}`,
    );
  }
  await click(buttons().find((b) => (b.textContent ?? '').trim() === '\u23ce') ?? null, 'enter');
};

describe('the solver of a stage is never stranded in it', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/?mock=1');
  });

  afterEach(async () => {
    if (root) await act(async () => root!.unmount());
    root = null;
    container?.remove();
  });

  /*
   * One walkthrough rather than four, so the whole sequence is asserted in the
   * order a player lives it.
   */
  it('walks stage 1 as the solver', async () => {
    await openKeypad();

    // A wrong code unlocks nothing and offers nothing.
    await enterCode('123');
    await settle(400);
    expect(proceedButton(), 'wrong code must not offer a way forward').toBeNull();
    expect(hudText()).toContain('STAGE 1');

    await enterCode('417');
    await settle(300);

    /*
     * The combination that used to be impossible: a confirmation is on screen
     * AND the control out of the room is reachable. The proceed bar used to be
     * rendered only when no message was up.
     */
    expect(document.querySelectorAll('.toast').length).toBeGreaterThan(0);
    expect(proceedButton(), 'verified stage must offer a way forward at once').not.toBeNull();
    expect(proceedButton()!.textContent).toContain('Enter the cooling room');
    expect(proceedButton()!.disabled).toBe(false);

    // Every message expires. The solver is still in the room they solved,
    // rather than having been carried out of it as a teammate would be.
    await settle(9000);
    expect(hudText(), 'the solver keeps their position').toContain('STAGE 1');
    expect(proceedButton(), 'and still has the control').not.toBeNull();

    // And they move on when they choose to, not before.
    await click(proceedButton(), 'proceed');
    expect(hudText()).toContain('STAGE 2');
  }, 40000);
});
