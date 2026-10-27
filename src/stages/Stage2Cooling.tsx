/**
 * STAGE 2: RESTORE THE COOLING SYSTEM
 *
 * Optimisation. The team configures a machine to meet a safety constraint;
 * they are not entering "3" as a code.
 *
 * Why the derivative is necessary rather than decorative: seven click positions, a
 * quadratic flow response, and a protocol demanding 22 L/min. Q(x) reaches 22
 * only at its maximum, so the team must find where Q'(x) = 0. Guessing is
 * allowed but visibly unreliable; the meter shows flow FALLING past the peak,
 * exactly as the stage-1 notebook warned.
 *
 * Two things make the mathematics unavoidable rather than optional:
 *
 *  1. PRE-START INTERLOCK. The controller will not turn the pump over until
 *     the operator declares the flow they expect at the chosen setting, and it
 *     checks that against the curve. Without this the stage collapses: setting
 *     3 is the MIDPOINT of the dial's travel, so "try the middle one"
 *     solves it on the first guess, and seven free test-fires solve it by
 *     brute force with no calculus at all. Now every attempt costs an
 *     evaluation of Q, and a failed check leaks nothing about the right
 *     setting.
 *  2. THE CURVE IS DRAWN, BUT THE X-AXIS IS NOT LABELLED. The shape is the
 *     motivation for the whole stage: it rises, peaks and falls again, so
 *     there is clearly a best setting to find, and only the very top of it
 *     clears the 22 L/min line. Withholding the curve entirely (an earlier
 *     version) left teams unsure the problem even had a shape. But a labelled
 *     x-axis, or countable vertical gridlines, would let the peak be read
 *     straight off the plot, so both are switched off.
 *
 *     The tangent is drawn only at settings the team has actually STARTED.
 *     Each start costs a correct pre-start declaration, so seeing the tangent
 *     go flat at the peak is a reward for having used the formula, not a way
 *     around it.
 *
 * A wrong setting that passes the start-up check still runs, and gives a
 * realistic consequence (insufficient flow, protocol refuses to clear the
 * stage) rather than a buzzer.
 */

import { useEffect, useState } from 'react';
import { setPump, sfx } from '../audio/engine';
import { DocumentModal } from '../components/DocumentView';
import { FunctionGraph } from '../components/FunctionGraph';
import type { HotspotDef } from '../components/Hotspot';
import { ProceedBar } from '../components/ProceedBar';
import { CoolingScene } from '../components/RoomScene';
import { StageLayout } from '../components/StageLayout';
import { Toast, type ToastData } from '../components/Toast';
import { Modal, Readout } from '../components/ui';
import { useEscapp } from '../escapp/EscappProvider';
import { documentById } from '../game/documents';
import { useGame } from '../game/GameProvider';
import { MIN_FLOW, PUMP_SETTINGS, Q, dQ, predictionMatches } from '../game/model';

const HOTSPOTS: HotspotDef[] = [
  { id: 'reservoir', label: 'Coolant Reservoir', description: 'A pressurised coolant tank, roughly two-thirds full.', x: 6, y: 27, w: 14, h: 52 },
  { id: 'pump', label: 'Pump B: Dial', description: 'The failed coolant pump with a seven-position dial beneath it.', x: 34, y: 47, w: 15, h: 32 },
  { id: 'flowmeter', label: 'Flow Meter', description: 'An in-line flow meter on the chamber riser, reading litres per minute.', x: 72.5, y: 35, w: 13, h: 15 },
  { id: 'binder', label: 'Engineering Binder', description: 'Ring binders and a personal notebook on a shelf.', x: 56, y: 71, w: 10, h: 8 },
];

export const Stage2Cooling = ({ onAdvance }: { onAdvance: () => void }) => {
  const { state, dispatch } = useGame();
  const { submitStage, verifiedStages, status } = useEscapp();
  const [view, setView] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [busy, setBusy] = useState(false);
  /** The operator's entered expected flow, as typed. */
  const [entered, setEntered] = useState('');

  const verified = verifiedStages.includes(2);
  /** Has the team found the test report yet? */
  const hasReport = state.documents.includes('calibration-report');
  const setting = state.pumpSetting;
  const flow = Q(setting);
  const slope = dQ(setting);
  const meets = flow >= MIN_FLOW;

  const open = (id: string) => {
    sfx('click');
    setView(id);
    dispatch({ type: 'inspect', id });
  };

  // The machine is audible: pitch and level track the flow it is delivering,
  // so a bad setting sounds like a bad setting.
  useEffect(() => {
    setPump(state.pumpRunning, flow);
    return () => setPump(false, 0);
  }, [state.pumpRunning, flow]);

  /**
   * Try to start the pump.
   *
   * Three gates, in order: the pre-start safety lock (did you consult the
   * curve?), then the protocol (is the resulting flow sufficient?), then
   * Escapp (is this the configuration we accept?).
   */
  const activate = async () => {
    const predicted = Number(entered.trim());

    // Gate 1; the pre-start safety lock. Refuses without leaking anything.
    if (entered.trim() === '' || !predictionMatches(setting, predicted)) {
      dispatch({ type: 'recordFailure', stage: 2 });
      setToast({
        tone: 'warn',
        title: 'PUMP WILL NOT START',
        body:
          entered.trim() === ''
            ? `The controller will not start the pump until you type in the flow you expect at setting ${setting}. The figure comes from test report ENG-2291-B.`
            : `Entered ${predicted} L/min at setting ${setting}, which does not match the test report ENG-2291-B. The pump will not turn over. Re-check the curve.`,
      });
      return;
    }

    setBusy(true);
    setToast(null);
    dispatch({ type: 'setPumpRunning', value: true });
    dispatch({ type: 'logFlow', x: setting, flow });

    if (!meets) {
      dispatch({ type: 'recordFailure', stage: 2 });
      setBusy(false);
      setView(null);
      setToast({
        tone: 'bad',
        title: 'NOT ENOUGH COOLANT',
        body: `Your figure was right: setting ${setting} does deliver ${flow} L/min. But rule EC-4 requires ${MIN_FLOW} L/min steady, so this configuration cannot cool the chamber. Find a setting that clears the minimum.`,
      });
      return;
    }

    const result = await submitStage(2, String(setting));
    setBusy(false);
    setView(null);

    if (!result.reachedServer) {
      setToast({
        tone: 'warn',
        title: 'SETTING NOT CHECKED',
        body: `${result.error ?? 'The facility network is not responding.'} The pump runs, but the setting was not logged.`,
      });
    } else if (result.verified) {
      // The success message is raised by the shell (game/notifications.ts), so
      // a teammate receiving this progress sees exactly the same thing.
      setToast(null);
    } else {
      dispatch({ type: 'recordFailure', stage: 2 });
      setToast({
        tone: 'bad',
        title: 'SETTING REFUSED',
        body: 'The safety system did not accept this configuration. Re-check the test report.',
      });
    }
  };

  return (
    <StageLayout
      stage={2}
      objective={
        verified
          ? 'Coolant flow established and holding.'
          : state.documents.includes('calibration-report')
            ? 'Set the dial so the flow meets the protocol minimum.'
            : 'Find out how the pump responds, then configure it.'
      }
      stats={[
        { label: 'SET', value: String(setting) },
        {
          label: 'FLOW',
          value: state.pumpRunning ? `${flow}` : '––',
          tone: state.pumpRunning ? (meets ? 'ok' : 'bad') : undefined,
        },
        { label: 'MIN', value: String(MIN_FLOW), tone: 'warn' },
      ]}
      scene={<CoolingScene running={state.pumpRunning} flow={flow} />}
      hotspots={HOTSPOTS}
      seen={state.inspected}
      onHotspot={open}
    >
      {toast && <Toast data={toast} onClose={() => setToast(null)} />}
      {!toast && (
        <ProceedBar
          verified={verified}
          ready={verified && state.pumpRunning && meets}
          label="Proceed to thermal monitoring"
          waitingLabel="The pump is not running here; your team has it set correctly."
          onProceed={onAdvance}
        />
      )}

      {/* ------------------------------------------------- the pump console */}

      {view === 'pump' && (
        <Modal title="Pump B: Dial" onClose={() => setView(null)} wide>
          <div className="grid-2" style={{ gap: 16 }}>
            <div className="pump-dial">
              <div className="dial-track" role="group" aria-label="Dial setting, 0 to 6">
                {PUMP_SETTINGS.map((x) => (
                  <button
                    key={x}
                    className="dial-detent"
                    data-active={x === setting}
                    aria-pressed={x === setting}
                    aria-label={`Dial setting ${x}`}
                    disabled={busy}
                    onClick={() => {
                      dispatch({ type: 'setPump', value: x });
                      setEntered('');
                      setToast(null);
                    }}
                  >
                    <span className="tick" aria-hidden="true" />
                    {x}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <Readout label="Setting" value={String(setting)} />
                </div>
                <div style={{ flex: 1 }}>
                  <Readout
                    label="Measured flow"
                    value={state.pumpRunning ? flow.toFixed(0) : '––'}
                    unit="L/min"
                    tone={state.pumpRunning ? (meets ? 'good' : 'bad') : undefined}
                  />
                </div>
              </div>

              {/* The pre-start safety lock. */}
              <div className="prestart">
                <label className="prestart-label" htmlFor="entered-flow">
                  Before you start: expected flow at setting {setting}
                </label>
                <div className="prestart-row">
                  <input
                    id="entered-flow"
                    className="prestart-input"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="––"
                    value={entered}
                    disabled={busy || verified}
                    onChange={(e) => {
                      setEntered(e.target.value);
                      setToast(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !busy && !verified) void activate();
                    }}
                    aria-describedby="prestart-help"
                  />
                  <span className="prestart-unit">L/min</span>
                </div>
                <p id="prestart-help" className="prestart-help">
                  The pump will not start until your number matches the test report ENG-2291-B.
                </p>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={busy || verified || status === 'unsupported'}
                onClick={() => void activate()}
              >
                {busy ? 'Spinning up…' : state.pumpRunning ? '↻ Restart at this setting' : '▶ Start pump'}
              </button>
            </div>

            <div>
              <FunctionGraph
                f={Q}
                df={dQ}
                domain={[0, 6]}
                range={[0, 26]}
                xLabel="dial setting x"
                yLabel="flow Q (L/min)"
                xTicks={false}
                tangentAt={state.flowLog.some((e) => e.x === setting) ? setting : null}
                limit={{ y: MIN_FLOW, label: `needs ${MIN_FLOW}` }}
                markers={state.flowLog.map((e) => ({ x: e.x, label: `${e.flow}` }))}
                caption="Pump flow against dial setting. The curve rises to a peak and falls away again, and only its highest part reaches the required flow. The dial settings are not marked on the axis."
              />

              {/*
                Once the report has been found there is no reason to make the
                team keep reopening it, so the equation is pinned here as a
                reference. The reasoning stays theirs; only the lookup is
                saved.
              */}
              {hasReport ? (
                <div className="curve-ref">
                  <div className="curve-ref-head">Test report ENG-2291-B</div>
                  <div className="curve-ref-eq mono">Q(x) = −2x² + 12x + 5</div>
                  <div className="curve-ref-sub">
                    L/min, for 0 ≤ x ≤ 6 · integer click positions only
                  </div>
                </div>
              ) : (
                <div className="log-note">
                  <span aria-hidden="true">📄</span>
                  <p>
                    The dial settings are not marked on this axis. The formula for the curve is in{' '}
                    <strong>test report ENG-2291-B</strong>, in the folders on the shelf.
                  </p>
                </div>
              )}
              {/*
                The concept, not the answer. Explaining why the top of the
                curve is where the rate of change is zero is teaching; it still
                leaves the team to find WHERE that is.
              */}
              <details className="why">
                <summary>Why does the top of the curve matter?</summary>
                <p>
                  On the way up, turning the dial one step higher gives you more flow. Past the
                  top, turning it higher gives you less. So right at the top it does neither: a
                  small turn either way barely changes the flow at all.
                </p>
                <p>
                  That is what marks the best setting. The flow has stopped rising and has not yet
                  started to fall, so <strong>the rate at which flow changes is zero there</strong>.
                  Find the setting where that rate is zero and you have found the peak.
                </p>
              </details>

              {state.pumpRunning && state.flowLog.some((e) => e.x === setting) && (
                <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '8px 0 0' }}>
                  Response slope at setting {setting}:{' '}
                  <strong className="mono">
                    {slope > 0 ? '+' : ''}
                    {slope} L/min per step
                  </strong>{' '}
                 {' '}
                  {slope > 0
                    ? 'still rising.'
                    : slope < 0
                      ? 'falling; the dial is choking the line.'
                      : 'level: this is the peak of the response.'}
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------- other objects */}

      {view === 'binder' && (
        <Modal title="Engineering Binder" onClose={() => setView(null)}>
          <div style={{ display: 'grid', gap: 9 }}>
            {['calibration-report', 'emergency-protocol', 'vale-notebook'].map((id) => {
              const d = documentById(id)!;
              return (
                <button
                  key={id}
                  className="interlock-row"
                  style={{ textAlign: 'left', width: '100%' }}
                  onClick={() => {
                    dispatch({ type: 'discoverDocument', id });
                    setView(null);
                    setDoc(id);
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: 19 }}>
                    {d.kind === 'protocol' ? '📕' : d.kind === 'log' ? '📓' : '📄'}
                  </span>
                  <span className="interlock-text">
                    <b>{d.title}</b>
                    <span>{d.source}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {view === 'flowmeter' && (
        <Modal title="Flow Meter" onClose={() => setView(null)}>
          <Readout
            label="Riser to chamber C-7"
            value={state.pumpRunning ? flow.toFixed(0) : '––'}
            unit="L/min"
            tone={state.pumpRunning ? (meets ? 'good' : 'bad') : undefined}
            note={
              state.pumpRunning
                ? meets
                  ? `Above the ${MIN_FLOW} L/min minimum.`
                  : `Below the ${MIN_FLOW} L/min minimum.`
                : 'The pump is not running.'
            }
          />
        </Modal>
      )}

      {view === 'reservoir' && (
        <Modal title="Coolant Reservoir" onClose={() => setView(null)}>
          <p style={{ marginTop: 0, fontSize: 13.5 }}>
            Sight glass shows roughly two-thirds full. Supply is not the problem.
          </p>
          <p style={{ color: 'var(--text-dim)', marginBottom: 0, fontSize: 13.5 }}>
            Chalked on the tank side: <em>"Plenty of coolant. The pump is the bottleneck."</em>
          </p>
        </Modal>
      )}

      {doc && documentById(doc) && (
        <DocumentModal doc={documentById(doc)!} onClose={() => setDoc(null)} />
      )}
    </StageLayout>
  );
};
