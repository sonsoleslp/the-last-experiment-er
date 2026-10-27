/**
 * Escapp connection state, always visible when it is not healthy.
 *
 * NAMING: the platform is never named in anything in-fiction. A student in the
 * middle of a rescue should not read the word "Escapp" in a facility warning.
 * It IS named in the two banners below that exist for whoever is RUNNING the
 * room (simulated mode, author preview) and in the setup-problem banner, where
 * naming it is the actionable information rather than a brand leak.
 *
 * Two distinct messages, because they mean different things to a class:
 *  - OFFLINE: Escapp is unreachable. Nothing can be verified; the team should
 *    wait and retry. We never present unverified work as progress.
 *  - SIMULATED: the mock adapter is in use. Verification is local and is not
 *    being recorded by Escapp. Labelled loudly so a teacher cannot mistake a
 *    development session for a real one.
 */

import { useEscapp } from '../escapp/EscappProvider';

export const ConnectionBanner = () => {
  const { status, isMock, isPreview, configError, retry } = useEscapp();

  /*
   * A stale configured solution makes a stage unsolvable, so this outranks
   * everything else the banner might say.
   */
  if (configError) {
    return (
      <div className="conn-banner" data-tone="bad" role="alert">
        <span aria-hidden="true">🔧</span>
        <div style={{ flex: 1 }}>
          <b>Escape room setup problem.</b> {configError}
        </div>
      </div>
    );
  }

  if (status === 'offline' || status === 'unsupported') {
    return (
      <div className="conn-banner" data-tone="bad" role="alert">
        <span aria-hidden="true">⚠</span>
        <div style={{ flex: 1 }}>
          <b>Facility uplink lost.</b>{' '}
          {status === 'unsupported'
            ? 'The verification service could not be loaded, so answers cannot be confirmed.'
            : 'The facility network is not responding, so answers cannot be confirmed right now. Your findings are safe: reconnect and submit again.'}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={retry}>
          Reconnect
        </button>
      </div>
    );
  }

  if (isMock) {
    return (
      <div className="conn-banner" data-tone="warn" role="status">
        <span aria-hidden="true">🧪</span>
        <div>
          <b>SIMULATED MODE.</b> Answers are checked locally by the mock adapter.{' '}
          <strong>Nothing is being verified or recorded by Escapp.</strong>
        </div>
      </div>
    );
  }

  if (isPreview) {
    return (
      <div className="conn-banner" data-tone="warn" role="status">
        <span aria-hidden="true">👁</span>
        <div>
          <b>AUTHOR PREVIEW.</b> Answers are really being verified by Escapp, but it does not record
          an author's practice run: <strong>progress is not saved and will reset on reload.</strong>
        </div>
      </div>
    );
  }

  return null;
};
