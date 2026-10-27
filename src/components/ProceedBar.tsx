/**
 * The transition between stages, floating over the scene.
 *
 * Verification and transition stay separate events: Escapp may verify a stage
 * the moment the decisive answer is submitted, but the person who submitted it
 * should not be teleported out of the room mid-sentence. They still want to
 * pick up the access card, or watch the coolant settle. So this appears once
 * the stage is verified, and they move on when they choose.
 *
 * `ready` IS NOT A GATE, and must never become one again.
 *
 * It used to be. Stage 2 passed `ready={verified && pumpRunning && meets}` and
 * stage 1 passed `ready={hasCard}` — conditions on LOCAL state, built by
 * whoever did the work. A teammate who received the progress over the
 * websocket had none of it: they saw "✓ Verified" and a line telling them to
 * leave the pump running, with no button and no way to reach stage 3. The
 * stage was complete for their team and they were stranded in it.
 *
 * So: when a stage is verified there is ALWAYS a way forward. `ready` now only
 * decides whether to add a nudge about unfinished business in the room, which
 * is advice for the solver and simply absent for everyone else.
 */

export const ProceedBar = ({
  verified,
  ready,
  label,
  waitingLabel,
  onProceed,
}: {
  verified: boolean;
  /** Any remaining in-room business is done. Advisory only, never blocking. */
  ready: boolean;
  label: string;
  /** Shown when `ready` is false, as a nudge rather than a condition. */
  waitingLabel?: string;
  onProceed: () => void;
}) => {
  if (!verified) return null;

  return (
    <div className="proceed" role="status">
      <span className="chip" data-tone="ok" style={{ flex: 'none' }}>
        ✓ Verified
      </span>
      <span className="proceed-text">
        {ready ? 'Progress saved.' : (waitingLabel ?? 'Progress saved.')}
      </span>
      <button className="btn btn-primary btn-sm" onClick={onProceed}>
        {label} →
      </button>
    </div>
  );
};
