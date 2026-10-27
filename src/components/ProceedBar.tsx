/**
 * The transition between stages, floating over the scene.
 *
 * Verification and transition stay separate events: Escapp may verify a stage
 * the moment the decisive answer is submitted, but the team should not be
 * teleported out of a room mid-sentence: they still need to pick up the
 * access card or watch the coolant stabilise. So this appears once the stage is
 * verified and any remaining in-room business is done, and they move on when
 * they choose.
 */

export const ProceedBar = ({
  verified,
  ready,
  label,
  waitingLabel,
  onProceed,
}: {
  verified: boolean;
  ready: boolean;
  label: string;
  waitingLabel?: string;
  onProceed: () => void;
}) => {
  if (!verified) return null;

  return (
    <div className="proceed" role="status">
      <span className="chip" data-tone="ok" style={{ flex: 'none' }}>
        ✓ Verified
      </span>
      {ready ? (
        <>
          <span className="proceed-text">Progress recorded by Escapp.</span>
          <button className="btn btn-primary btn-sm" onClick={onProceed}>
            {label} →
          </button>
        </>
      ) : (
        <span className="proceed-text">{waitingLabel}</span>
      )}
    </div>
  );
};
