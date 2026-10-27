/**
 * STAGE 5: EMERGENCY RELEASE, and what a tangent actually is
 *
 * The team does not calculate the rate of change here. They BUILD it.
 *
 * Opening the release valve lets the chamber's extra pressure out along a
 * curve:
 *
 *     P(t) = 90 e^(-0.5t)
 *
 * The door motor needs to know how fast the pressure is falling right now.
 * The console gives them the curve, the gauge reading fixes one point on it,
 * and they rotate a straight line through that point until it stops cutting
 * the curve and merely touches it. The console then reads the gradient off
 * their own line. That gradient is the rate.
 *
 * This is the idea the whole room has been circling, made physical: the
 * derivative is the gradient of the tangent. Too shallow or too steep and the
 * console shows exactly where the line cuts the curve a second time. Only one
 * line touches once.
 *
 * CHORD MODE ties it back to stage 3. Place a second point, see the chord's
 * gradient, slide the point closer, and watch that gradient close in on the
 * tangent's: the average rate over a shrinking interval becoming the rate at
 * an instant, on a slider.
 *
 * No differentiation is required, deliberately. An earlier version asked
 * students to differentiate an exponential, which was a step beyond the rest
 * of the room, and a version after that handed them a "halve the gauge
 * reading" rule, which was easy but taught nothing. Measuring a gradient off a
 * curve they can see is both easier than the first and far more conceptual
 * than the second.
 *
 * Two vent bursts, so there is a real decision with a consequence:
 *   burst 1 -> 34 kPa -> tangent gradient -17, over the 12 limit -> vent again
 *   burst 2 -> 22 kPa -> tangent gradient -11, within the limit  -> run it
 * Running the motor at burst 1 jams the door: recoverable, and loud about why.
 */

import { useEffect, useState } from 'react';
import { setScene, sfx } from '../audio/engine';
import { DocumentModal } from '../components/DocumentView';
import type { HotspotDef } from '../components/Hotspot';
import { ChamberScene } from '../components/RoomScene';
import { StageLayout } from '../components/StageLayout';
import { Toast, type ToastData } from '../components/Toast';
import { TangentTool } from '../components/TangentTool';
import { Alert, Chip, Modal, Readout } from '../components/ui';
import { useEscapp } from '../escapp/EscappProvider';
import { documentById } from '../game/documents';
import { useGame } from '../game/GameProvider';
import {
  canVent,
  fireOutcome,
  holdPressureFor,
  type ReleaseState,
} from '../game/release';
import {
  SENSOR_READING_MINUTE,
  VENT_HOLDS,
  VENT_K,
  VENT_P0,
  VENT_RATE_LIMIT,
  correctIntervention,
  earliestSafeRelease,
  formatPressureRate,
  pressureFallRate,
  validPumpSettings,
  ventSafe,
} from '../game/model';

const HOTSPOTS: HotspotDef[] = [
  {
    id: 'controller',
    label: 'Release Controller',
    description: 'The emergency release controller: vent valve, pressure gauge and door motor.',
    x: 4, y: 32, w: 20, h: 38,
  },
  {
    id: 'valveplate',
    label: 'Valve Specification',
    description: 'A specification plate bolted beside the release valve.',
    x: 42, y: 27, w: 16, h: 5,
  },
  {
    id: 'seal',
    label: 'Door Seal',
    description: 'The chamber door seal assembly, wedges driven into the frame.',
    x: 30, y: 64, w: 40, h: 12,
  },
];

export const Stage5Release = () => {
  const { state, dispatch } = useGame();
  const { submitStage, verifiedStages, status, allSolved } = useEscapp();

  const [view, setView] = useState<string | null>('controller');
  const [doc, setDoc] = useState<string | null>(null);
  /** The gradient the team measured off their own tangent. */
  const [measured, setMeasured] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [jammed, setJammed] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  const verified = verifiedStages.includes(5);
  const released = verified;

  const cycles = state.ventCycles;
  const venting = cycles > 0;
  const armed = state.actuatorArmed;
  /*
   * The controller's rules live in game/release.ts as pure functions, so that
   * tests/release.test.ts can walk the whole state space and prove a team can
   * never jam themselves into an unwinnable position. Deriving the UI from the
   * same functions is what makes that proof worth anything.
   */
  const releaseState: ReleaseState = { cycles, jammed, armed };
  const holdPressure = holdPressureFor(cycles);
  const safe = holdPressure !== null && ventSafe(holdPressure);
  const chargeSpent = !canVent({ ...releaseState, jammed: false });

  useEffect(() => {
    if (released) {
      sfx('door');
      setScene('resolved');
    }
  }, [released]);

  /** Open the valve, or run another cycle. */
  const vent = () => {
    if (chargeSpent) return;
    sfx('latch');
    dispatch({ type: 'vent' });
    setMeasured(null);
    const next = VENT_HOLDS[cycles];
    setToast({
      tone: 'info',
      title: cycles === 0 ? 'RELEASE VALVE OPEN' : 'SECOND VENT CYCLE COMPLETE',
      body: `Vent cycle held. Gauge reads ${next} kPa extra pressure. The controller needs the rate of change before it will release the motor.`,
    });
  };

  /**
   * Accept a gradient the team measured with the tangent tool. The tool only
   * offers a reading once the line really is the tangent, so there is nothing
   * left to validate here.
   */
  const acceptReading = (gradient: number) => {
    setMeasured(gradient);
    dispatch({ type: 'armActuator', value: true });
    setToast({
      tone: 'ok',
      title: 'MOTOR UNLOCKED',
      body: `Your tangent gives ${formatPressureRate(gradient)}. The motor needs it below ${VENT_RATE_LIMIT} kPa/min. Run the motor, or let more pressure out first?`,
    });
  };

  /** Fire the door motor. The physics decides what happens. */
  const fire = async () => {
    if (holdPressure === null) return;

    if (fireOutcome({ ...releaseState, armed: true }) === 'jammed') {
      // Over the rate limit: the door slams and the wedges bind.
      dispatch({ type: 'recordFailure', stage: 5 });
      dispatch({ type: 'armActuator', value: false });
      setJammed(true);
      setMeasured(null);
      sfx('reject');
      setToast({
        tone: 'bad',
        title: 'DOOR MOTOR JAMMED',
        body: `At ${holdPressure} kPa the pressure was falling at ${formatPressureRate(pressureFallRate(holdPressure))}, over the ${VENT_RATE_LIMIT} kPa/min limit. The rush of escaping air slammed the door shut and jammed the motor. Ease it back, let more pressure out, and try again when it is falling more slowly.`,
      });
      return;
    }

    sfx('lever');
    setBusy(true);
    const payload = `${holdPressure};${pressureFallRate(holdPressure)};RELEASE`;
    const result = await submitStage(5, payload);
    setBusy(false);

    if (!result.reachedServer) {
      dispatch({ type: 'armActuator', value: false });
      setToast({
        tone: 'warn',
        title: 'COMMAND NOT SENT',
        body: `${result.error ?? 'Escapp could not be reached.'} The motor will not fire unrecorded. Reconnect and try again.`,
      });
      return;
    }
    if (result.verified) {
      setView(null);
      setToast(null);
    } else if (result.configMismatch) {
      // Not the player's fault: see the setup banner.
      dispatch({ type: 'armActuator', value: false });
      setToast({
        tone: 'warn',
        title: 'SAFETY SYSTEM OUT OF STEP',
        body: 'Your reading was right, but the safety system rejected it. Tell whoever set the room up: see the banner at the top.',
      });
    } else {
      dispatch({ type: 'armActuator', value: false });
      setToast({
        tone: 'bad',
        title: 'COMMAND REFUSED',
        body: 'The safety system did not accept this. Re-check your tangent reading.',
      });
    }
  };

  const clearJam = () => {
    sfx('click');
    setJammed(false);
    setToast(null);
  };

  /* ------------------------------------------------------------- outcome -- */

  if (released) {
    return (
      <StageLayout
        stage={5}
        objective="The door is open. Dr. Elena Vale is safe."
        stats={[
          { label: 'SEAL', value: 'OPEN', tone: 'ok' },
          { label: 'ALARM', value: 'SILENT', tone: 'ok' },
        ]}
        scene={<ChamberScene released armed={false} />}
        hotspots={[]}
        seen={state.inspected}
        onHotspot={() => {}}
      >
        <button className="proceed" style={{ cursor: 'pointer' }} onClick={() => setView('debrief')}>
          <Chip tone="ok">✓ Mission complete</Chip>
          <span className="proceed-text">Read the debrief →</span>
        </button>

        {view === 'debrief' && (
          <Modal title="Mission Debrief" onClose={() => setView(null)}>
            <div className="outro" style={{ padding: '6px 0 0' }}>
              <h1 style={{ fontSize: 22 }}>DR. ELENA VALE IS SAFE</h1>
              <div className="outro-body" style={{ textAlign: 'left', fontSize: 13.5 }}>
                <p>
                  The wedges withdraw clean and the door swings outward on its own weight. The
                  alarms cut out mid-cycle and the silence is louder than they were.
                </p>
                <p>
                  Dr. Vale pulls the mask off and breathes corridor air. Unsteady, and fine. "You
                  waited for the second vent cycle," she says. "Most people don't."
                </p>
                <p>
                  "The gauge only tells you the pressure. It never tells you how fast it's
                  dropping: you have to know that the rate is in step with what's left." She
                  looks at the jammed-door warning still lit on the console. "Fire that motor a
                  cycle early and I'm still in there, behind a door nobody can open."
                </p>
                <p style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>
                  Coolant restored at dial setting 3, the highest point of the pump's curve.
                  Cooling left alone because the temperature was falling at 4 °C per minute, inside
                  the 5 °C limit. Door agreed for the earliest minute where all three rules held.
                  Motor run at 22 kPa, where the pressure was falling at half of that, 11 kPa per
                  minute, under the 12 limit.
                </p>
              </div>
              {allSolved && <Chip tone="ok">All five stages verified by Escapp</Chip>}
            </div>
          </Modal>
        )}
      </StageLayout>
    );
  }

  /* ------------------------------------------------------------ controller */

  return (
    <StageLayout
      stage={5}
      objective={
        !venting
          ? 'Open the release valve.'
          : jammed
            ? 'The motor stalled. Clear the fault and vent further.'
            : armed
              ? `Actuator limit ${VENT_RATE_LIMIT} kPa/min: fire, or vent again.`
              : 'Build the tangent on the curve to measure how fast the pressure is falling.'
      }
      stats={[
        {
          label: 'GAUGE',
          value: holdPressure === null ? '––' : `${holdPressure} kPa`,
          tone: holdPressure === null ? undefined : safe ? 'ok' : 'warn',
        },
        { label: 'LIMIT', value: `${VENT_RATE_LIMIT} kPa/min` },
        { label: 'CYCLES', value: `${cycles}/${VENT_HOLDS.length}` },
      ]}
      scene={<ChamberScene released={false} armed={armed} />}
      hotspots={HOTSPOTS}
      seen={state.inspected}
      onHotspot={(id) => {
        sfx('click');
        setView(id);
        dispatch({ type: 'inspect', id });
      }}
    >
      {toast && <Toast data={toast} onClose={() => setToast(null)} />}

      {view === 'controller' && (
        <Modal title="Emergency Release Controller" onClose={() => setView(null)} wide>
          <div className="grid-2" style={{ gap: 16 }}>
            {/* ------------------------------------------------ the vent */}
            <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              <Readout
                label="Chamber extra pressure"
                value={holdPressure === null ? '––' : String(holdPressure)}
                unit="kPa"
                tone={holdPressure === null ? undefined : safe ? 'good' : 'warn'}
                note={
                  holdPressure === null
                    ? 'The release valve is shut.'
                    : 'Vent holding. The gauge does not report elapsed time.'
                }
              />

              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={chargeSpent || busy || jammed}
                onClick={vent}
              >
                {!venting
                  ? '▶ Open the release valve'
                  : chargeSpent
                    ? 'Valve empty: no more bursts'
                    : '↻ Let more pressure out'}
              </button>

              {/* The tangent tool IS the task: measure the gradient off the curve. */}
              {venting && !jammed && holdPressure !== null && (
                <TangentTool
                  pressure={holdPressure}
                  locked={armed}
                  onResult={(r) => acceptReading(r.gradient)}
                />
              )}

              {chargeSpent && !jammed && (
                <Alert tone="info" title="NO MORE BURSTS">
                  The valve is empty, but the pressure is low enough now. Measure how fast it is
                  falling and run the motor.
                </Alert>
              )}

              {jammed && (
                <>
                  <Alert tone="bad" title="MOTOR JAMMED">
                    The wedges are jammed against the frame. Back the motor off before trying
                    again.
                  </Alert>
                  <button className="btn" style={{ width: '100%' }} onClick={clearJam}>
                    Ease the motor back
                  </button>
                </>
              )}
            </div>

            {/* -------------------------------------------- the motor */}
            <div className="lever-housing">
              <Readout
                label="From your tangent"
                value={measured !== null ? formatPressureRate(measured) : '––'}
                tone={armed ? (safe ? 'good' : 'bad') : undefined}
                note={`Actuator fires below ${VENT_RATE_LIMIT} kPa/min`}
              />

              <button
                className="lever"
                disabled={!armed || busy || jammed || status === 'unsupported'}
                onClick={() => void fire()}
                aria-label="Fire the door motor"
              >
                <span className="lever-slot" aria-hidden="true" />
                <span className="lever-handle" aria-hidden="true" />
              </button>
              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  color: armed ? 'var(--red)' : 'var(--text-faint)',
                }}
              >
                {busy ? 'FIRING…' : armed ? 'PULL TO FIRE' : 'LOCKED'}
              </div>

              <button className="btn btn-ghost btn-sm" onClick={() => setDoc('valve-spec')}>
                📄 Valve specification
              </button>
            </div>
          </div>

          {/* Continuity, not a quiz: what the facility already established. */}
          <details className="record">
            <summary>Mission record</summary>
            <ul>
              <li>Coolant pump B configured to setting {validPumpSettings()[0]}.</li>
              <li>
                Thermal intervention: {correctIntervention(SENSOR_READING_MINUTE).toLowerCase()}{' '}
                cooling.
              </li>
              <li>Release authorised at minute {earliestSafeRelease()}.</li>
              <li>
                Vent model: P(t) = {VENT_P0} e^(−{VENT_K}t) kPa.
              </li>
            </ul>
          </details>
        </Modal>
      )}

      {view === 'valveplate' && (
        <Modal title="Valve Specification Plate" onClose={() => setView(null)}>
          <p style={{ marginTop: 0, color: 'var(--text-dim)', fontSize: 13.5 }}>
            Bolted beside the release valve, etched rather than printed.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => {
              dispatch({ type: 'discoverDocument', id: 'valve-spec' });
              setView(null);
              setDoc('valve-spec');
            }}
          >
            📄 Read the valve specification
          </button>
        </Modal>
      )}

      {view === 'seal' && (
        <Modal title="Door Seal" onClose={() => setView(null)}>
          <Alert tone={jammed ? 'bad' : 'warn'} title={jammed ? 'WEDGES JAMMED' : 'SEAL ENGAGED'}>
            {jammed
              ? 'The wedges are bound against the frame after the motor stalled.'
              : 'Powered wedges driven into the frame, pull backed by a torque-limited motor.'}
          </Alert>
        </Modal>
      )}

      {doc && documentById(doc) && (
        <DocumentModal doc={documentById(doc)!} onClose={() => setDoc(null)} />
      )}
    </StageLayout>
  );
};
