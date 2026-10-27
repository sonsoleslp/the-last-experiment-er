/**
 * App shell and stage router.
 *
 * Progression security, which is the whole point of this component:
 *
 *  - The stage the player is looking at (`viewStage`) is React state only. It
 *    is never read from the URL, never read from localStorage, and never
 *    persisted. There is nothing to tamper with.
 *  - It is clamped on every render to `unlockedStage`, which is derived
 *    exclusively from Escapp's verified puzzle list. Editing local storage,
 *    changing the URL or using the browser's back/forward buttons cannot raise
 *    it, because none of those is an input to it.
 *  - Navigating *backwards* to an already-verified stage is allowed on
 *    purpose: teams need to re-read earlier evidence. Those stages render as
 *    complete and their decisive controls are disabled.
 *  - While Escapp is unreachable we hold the team where they are rather than
 *    guessing; no stage is ever unlocked on an unverified answer.
 */

import { useEffect, useRef, useState } from 'react';
import { Intro } from './components/Intro';
import { ConnectionBanner } from './components/ConnectionBanner';
import { Inventory } from './components/Inventory';
import { StageRail } from './components/StageRail';
import { MuteButton } from './audio/MuteButton';
import { setScene, type Scene } from './audio/engine';
import { useEscapp } from './escapp/EscappProvider';
import type { EscappStatus } from './escapp/types';
import { Toast, type ToastData } from './components/Toast';
import { useGame } from './game/GameProvider';
import { stageSolvedToast } from './game/notifications';
import { decideProgress } from './game/progression';
import { Stage1Lab } from './stages/Stage1Lab';
import { Stage2Cooling } from './stages/Stage2Cooling';
import { Stage3Thermal } from './stages/Stage3Thermal';
import { Stage4Window } from './stages/Stage4Window';
import { Stage5Release } from './stages/Stage5Release';

/**
 * Boot / failure screens, shown before the game tree mounts.
 *
 * Each non-ready status gets its own screen, because the remedies are
 * completely different: reconnect, sign in as someone else, or fix the
 * deployment. `detail` carries the adapter's specific diagnosis when it has
 * one, so nobody has to guess from a generic message.
 */
const BootScreen = ({
  status,
  detail,
  onRetry,
}: {
  status: Exclude<EscappStatus, 'ready'>;
  detail: string | null;
  onRetry: () => void;
}) => {
  const MockHint = () => (
    <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>
      Just want to play or develop? Add <code className="mono">?mock=1</code> to the URL to run the
      whole game against the development mock adapter, with no Escapp session.
    </p>
  );

  if (status === 'connecting') {
    return (
      <div className="boot-screen">
        <div className="spinner" role="status" aria-label="Connecting" />
        <h1>ESTABLISHING FACILITY UPLINK</h1>
        <p>
          Authenticating your response team with Escapp. If a sign-in dialog appears, complete it to
          continue.
        </p>
      </div>
    );
  }

  if (status === 'unsupported') {
    return (
      <div className="boot-screen">
        <h1 style={{ color: 'var(--red)' }}>ESCAPP CLIENT UNAVAILABLE</h1>
        <p>
          The Escapp client library could not be loaded, so your team cannot be identified and
          answers cannot be verified.
        </p>
        {detail && <p style={{ color: 'var(--amber)', fontSize: 13 }}>{detail}</p>}
        <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>
          Make sure <code className="mono">escapp.js</code> is served next to{' '}
          <code className="mono">index.html</code>: deploy all of <code className="mono">dist/</code>,
          not just its <code className="mono">assets/</code> folder.
        </p>
        <MockHint />
      </div>
    );
  }

  if (status === 'config') {
    return (
      <div className="boot-screen">
        <h1 style={{ color: 'var(--amber)' }}>ESCAPP CLIENT NOT CONFIGURED</h1>
        <p>
          The Escapp client loaded but refused to start, so nothing can be verified. This is a setup
          problem rather than something your team did.
        </p>
        {detail && <p style={{ color: 'var(--amber)', fontSize: 13 }}>{detail}</p>}
        <MockHint />
      </div>
    );
  }

  if (status === 'auth') {
    return (
      <div className="boot-screen">
        <h1 style={{ color: 'var(--amber)' }}>RESPONSE TEAM NOT IDENTIFIED</h1>
        <p>
          Escapp answered, but it has not validated who you are for this escape room, so no answer
          could be verified and no progress recorded.
        </p>
        {detail && <p style={{ color: 'var(--amber)', fontSize: 13 }}>{detail}</p>}
        <button className="btn btn-primary" onClick={onRetry}>
          Try again
        </button>
        <MockHint />
      </div>
    );
  }

  return (
    <div className="boot-screen">
      <h1 style={{ color: 'var(--red)' }}>FACILITY UPLINK LOST</h1>
      <p>
        Escapp cannot be reached right now, so your team's progress cannot be verified. Nothing has
        been lost: reconnect and carry on from where you were.
      </p>
      {detail && <p style={{ color: 'var(--amber)', fontSize: 13 }}>{detail}</p>}
      <button className="btn btn-primary" onClick={onRetry}>
        Reconnect
      </button>
    </div>
  );
};

const Game = () => {
  const { unlockedStage } = useEscapp();
  const { state, dispatch } = useGame();
  const [viewStage, setViewStage] = useState(1);

  /*
   * Reacting to the team's verified progress.
   *
   * The rule lives in game/progression.ts so it can be tested; the shape of it
   * is: on first load resume silently at the team's stage, and after that
   * always show the stage-solved notification before moving anybody.
   *
   * The notification is the SAME one the solver sees, from
   * game/notifications.ts, which is the whole point. A teammate gets the
   * identical message in the identical place, then the scene catches up once
   * they have read it. That is also why the Escapp client is configured with
   * restoreState: 'AUTO' rather than 'AUTO_NOTIFICATION': a modal dialog from
   * the client would be a different, interrupting message.
   */
  const previousUnlocked = useRef<number | null>(null);
  const [notice, setNotice] = useState<ToastData | null>(null);
  const pendingStage = useRef<number | null>(null);

  useEffect(() => {
    const decision = decideProgress({
      previousUnlocked: previousUnlocked.current,
      unlocked: unlockedStage,
      viewStage,
    });
    previousUnlocked.current = unlockedStage;

    if (decision.jumpTo !== null) setViewStage(decision.jumpTo);
    pendingStage.current = decision.advanceAfterNotice;
    if (decision.notifyStage !== null) {
      setNotice(stageSolvedToast(decision.notifyStage));
    }
    // viewStage is read, not tracked: this must run only when progress moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedStage]);

  /** Once the notification has been read, catch up with the team. */
  const dismissNotice = () => {
    setNotice(null);
    if (pendingStage.current !== null) {
      setViewStage(pendingStage.current);
      pendingStage.current = null;
    }
  };

  // The authoritative clamp. Even if state were corrupted, what we render can
  // never exceed Escapp-verified progress.
  const stage = Math.min(Math.max(viewStage, 1), unlockedStage);
  const advance = () => setViewStage(Math.min(stage + 1, unlockedStage));

  // Each room gets its own mix: the plant is loud with machinery, the chamber
  // is quiet and close, and the alarm stops once the rescue succeeds.
  const SCENES: Record<number, Scene> = {
    1: 'lab',
    2: 'plant',
    3: 'thermal',
    4: 'chamber',
    5: 'chamber',
  };
  useEffect(() => {
    if (state.briefingSeen) setScene(SCENES[stage] ?? 'lab');
  }, [stage, state.briefingSeen]);

  if (!state.briefingSeen) return <Intro onFinish={() => dispatch({ type: 'seeBriefing' })} />;

  return (
    <>
      {/*
        Shell-level notification, so it survives the stage changing underneath
        it. Stages still raise their own failure messages locally.
      */}
      {notice && (
        <div className="toast-shell">
          <Toast data={notice} onClose={dismissNotice} />
        </div>
      )}
      {stage === 1 && <Stage1Lab onAdvance={advance} />}
      {stage === 2 && <Stage2Cooling onAdvance={advance} />}
      {stage === 3 && <Stage3Thermal onAdvance={advance} />}
      {stage === 4 && <Stage4Window onAdvance={advance} />}
      {stage === 5 && <Stage5Release />}
    </>
  );
};

export default function App() {
  const { status, statusDetail, retry, allSolved, isMock, isPreview } = useEscapp();

  if (status !== 'ready') {
    return (
      <div className="app-shell">
        <div className="scene">
          <BootScreen status={status} detail={statusDetail} onRetry={retry} />
        </div>
      </div>
    );
  }

  const hasBanner = isMock || isPreview;

  return (
    <div className="app-shell" data-banner={hasBanner}>
      {!allSolved && <div className="emergency-wash" aria-hidden="true" />}
      <div className="scanlines" aria-hidden="true" />

      <header className="topbar">
        <div className="topbar-title">
          <b>THE LAST EXPERIMENT</b>
          <span>MERIDIAN · SUBLEVEL 3</span>
        </div>
        <div className="topbar-spacer" />
        <StageRail />
        <MuteButton />
        <div
          className="chip"
          data-tone={allSolved ? 'ok' : 'bad'}
          role="status"
          aria-label={allSolved ? 'Emergency resolved' : 'Emergency active'}
        >
          {allSolved ? '✓ RESOLVED' : '● LOCKDOWN'}
        </div>
      </header>

      <ConnectionBanner />

      <Game />

      <Inventory />
    </div>
  );
}
