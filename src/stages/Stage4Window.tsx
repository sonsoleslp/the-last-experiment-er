/**
 * STAGE 4: SOLVE FOR WHEN, NOT EVALUATE AT GIVEN POINTS
 *
 * The distinct idea here is the inverse problem. Stages 3 and 5 hand the team
 * a moment and ask for the rate there. This stage hands them a requirement and
 * asks WHEN it is met, which means solving rather than substituting:
 *
 *   (1) T(t) <= 15   =>  t^2 - 8t + 15 <= 0  =>  (t-3)(t-5) <= 0  =>  3 <= t <= 5
 *   (2) T'(t) <= 0   =>  2t - 8 <= 0                              =>  t <= 4
 *   (3) air          =>                                              t <= 3.5
 *
 *   intersection = [3, 3.5]   =>   earliest safe release at t = 3
 *
 * An earlier version listed t = 2, 3, 4 as buttons and asked the team to check
 * each. That made this a third helping of "evaluate the derivative at a point"
 * and gave away that the answer was one of three integers. The candidates are
 * gone; the team enters the earliest safe time themselves.
 *
 * The rehearsal tool still lets them test any time they choose, which is how
 * engineers actually work and keeps the instructive failures reachable: t = 4
 * is the coldest and most stable moment available and it kills Dr. Vale,
 * because her air ran out at 3.5.
 *
 * TIMER: the 3.5 minutes is simulated experiment time, labelled as such.
 * Nothing here runs against a real clock.
 */


import { useState } from 'react';
import { DocumentModal } from '../components/DocumentView';
import { FunctionGraph } from '../components/FunctionGraph';
import type { HotspotDef } from '../components/Hotspot';
import { sfx } from '../audio/engine';
import { ProceedBar } from '../components/ProceedBar';
import { SceneStrip } from '../components/SceneStrip';
import { ChamberScene } from '../components/RoomScene';
import { StageLayout } from '../components/StageLayout';
import { Toast, type ToastData } from '../components/Toast';
import { Alert, Modal, Readout } from '../components/ui';
import { useEscapp } from '../escapp/EscappProvider';
import { documentById } from '../game/documents';
import { useGame } from '../game/GameProvider';
import {
  AIR_SUPPLY_MINUTES,
  SAFE_TEMP_MAX,
  T,
  dT,
  evaluateRelease,
  formatRate,
  releaseWindow,
} from '../game/model';

const HOTSPOTS: HotspotDef[] = [
  { id: 'window', label: 'Observation Window', description: 'A thick port into chamber C-7. Dr. Vale is seated against the far wall, conscious.', x: 38, y: 30, w: 24, h: 33 },
  { id: 'airgauge', label: 'Air Supply', description: 'The person inside life-support panel, showing the remaining emergency air.', x: 6, y: 33, w: 18, h: 35 },
  { id: 'console', label: 'Safety Console', description: 'The chamber release console, predicting conditions at each candidate window.', x: 30, y: 66, w: 40, h: 10 },
  { id: 'protocolplate', label: 'Protocol Plate', description: 'A steel plate riveted beside the chamber, engraved with the release protocol.', x: 42, y: 27, w: 16, h: 5 },
];

export const Stage4Window = ({ onAdvance }: { onAdvance: () => void }) => {
  const { state, dispatch } = useGame();
  const { submitStage, verifiedStages, status } = useEscapp();
  const [view, setView] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  /** The earliest safe time the team proposes, as typed. */
  const [answer, setAnswer] = useState(
    state.proposedRelease === null ? '' : String(state.proposedRelease),
  );
  /** A time the team wants to rehearse, as typed. */
  const [rehearse, setRehearse] = useState('');
  const [inspecting, setInspecting] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [busy, setBusy] = useState(false);

  const verified = verifiedStages.includes(4);

  const open = (id: string) => {
    sfx('click');
    setView(id);
    dispatch({ type: 'inspect', id });
  };

  /**
   * File the plan. The payload carries the whole safety argument, not a bare
   * number: the minute, with the temperature and rate that justify it.
   */
  const confirmPlan = async () => {
    const t = Number(answer.trim());
    if (answer.trim() === '' || !Number.isFinite(t) || t < 0) {
      setToast({
        tone: 'warn',
        title: 'NO RELEASE TIME ENTERED',
        body: 'Enter the earliest time, in minutes since manual cooling began, at which all three conditions hold.',
      });
      return;
    }

    const check = evaluateRelease(t);

    // Refuse an unsafe time locally and name the condition that fails, before
    // troubling Escapp with it.
    if (!check.safe) {
      dispatch({ type: 'recordFailure', stage: 4 });
      const why: string[] = [];
      if (!check.tempOk)
        why.push(`at t = ${t} the chamber is ${check.temperature.toFixed(1)} °C, above the ${SAFE_TEMP_MAX} °C seal limit`);
      if (!check.rateOk)
        why.push(`at t = ${t} the temperature is still rising at ${formatRate(check.rate)}`);
      if (!check.airOk)
        why.push(`t = ${t} is beyond the ${AIR_SUPPLY_MINUTES}-minute air supply`);
      setToast({
        tone: 'bad',
        title: 'RELEASE PLAN REFUSED',
        body: `Rule CR-2 turned it down: ${why.join('; ')}. All three conditions must hold at the same moment.`,
      });
      return;
    }

    setBusy(true);
    setToast(null);
    const result = await submitStage(4, `${t};${check.temperature};${check.rate}`);
    setBusy(false);

    if (!result.reachedServer) {
      setToast({
        tone: 'warn',
        title: 'PLAN NOT FILED',
        body: `${result.error ?? 'The facility network is not responding.'} Nothing was logged, try again.`,
      });
      return;
    }

    if (result.verified) {
      dispatch({ type: 'proposeRelease', value: t });
      setView(null);
      setToast({
        tone: 'ok',
        title: `RELEASE PLAN ACCEPTED: t = ${t} MIN`,
        body: `${check.temperature} °C, changing at ${formatRate(check.rate)}, inside the air supply. The release system is armed.`,
      });
    } else {
      dispatch({ type: 'recordFailure', stage: 4 });
      setToast({
        tone: 'bad',
        title: 'NOT THE EARLIEST SAFE MOMENT',
        body: `t = ${t} min does satisfy all three conditions, but CR-2 requires the EARLIEST time at which they all hold. Every second earlier is air she still has. Solve the conditions rather than picking a time that works.`,
      });
    }
  };

  const insp = inspecting !== null ? evaluateRelease(inspecting) : null;

  return (
    <StageLayout
      stage={4}
      objective={
        verified
          ? `Release plan filed for minute ${state.proposedRelease}.`
          : 'Work out the earliest time at which all three conditions hold.'
      }
      stats={[
        { label: 'LIMIT', value: `${SAFE_TEMP_MAX}°C` },
        { label: 'AIR', value: `${AIR_SUPPLY_MINUTES} min`, tone: 'bad' },
        { label: 'SIM CLOCK', value: 'PAUSED' },
      ]}
      scene={<ChamberScene released={false} armed={verified} />}
      hotspots={HOTSPOTS}
      seen={state.inspected}
      onHotspot={open}
    >
      <SceneStrip>
        {toast && <Toast data={toast} onClose={() => setToast(null)} />}
        <ProceedBar
          verified={verified}
          ready={verified}
          label="Go to the release controls"
          waitingLabel={
            releaseWindow()
              ? `Window: t = ${releaseWindow()!.earliest} to ${releaseWindow()!.latest} min.`
              : undefined
          }
          onProceed={onAdvance}
        />
      </SceneStrip>

      {/* --------------------------------------------------- safety console */}

      {view === 'console' && (
        <Modal title="Chamber Door Console: Rule CR-2" onClose={() => setView(null)} wide>
          <div className="grid-2" style={{ gap: 16 }}>
            <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              {/* The three conditions, stated but not solved. */}
              <div className="conditions">
                <div className="conditions-head">Release conditions</div>
                <ol>
                  <li>
                    Chamber temperature at or below{' '}
                    <strong className="mono">{SAFE_TEMP_MAX} °C</strong>
                  </li>
                  <li>Temperature not increasing</li>
                  <li>
                    Within the person inside air supply of{' '}
                    <strong className="mono">{AIR_SUPPLY_MINUTES} min</strong>
                  </li>
                </ol>
                <p>
                  CR-2 requires the <strong>earliest</strong> time at which all three hold at once.
                </p>
              </div>

              {/* The answer: a time they have to solve for. */}
              <div className="prestart">
                <label className="prestart-label" htmlFor="release-time">
                  Earliest safe release time
                </label>
                <div className="prestart-row">
                  <input
                    id="release-time"
                    className="prestart-input"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="––"
                    value={answer}
                    disabled={busy || verified}
                    onChange={(e) => {
                      setAnswer(e.target.value);
                      setToast(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !busy && !verified) void confirmPlan();
                    }}
                  />
                  <span className="prestart-unit">min</span>
                </div>
                <p className="prestart-help">
                  Minutes since manual cooling began.
                </p>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%', marginTop: 9 }}
                  disabled={busy || verified || status === 'unsupported'}
                  onClick={() => void confirmPlan()}
                >
                  {busy ? 'Filing plan…' : verified ? `✓ Filed at t = ${state.proposedRelease}` : 'File release plan'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              <FunctionGraph
                f={T}
                df={dT}
                domain={[0, 6]}
                range={[12, 32]}
                xLabel="t (minutes of manual cooling)"
                yLabel="T (°C)"
                tangentAt={rehearse.trim() === '' ? null : Number(rehearse)}
                limit={{ y: SAFE_TEMP_MAX, label: `seal limit ${SAFE_TEMP_MAX} °C` }}
                caption="Predicted chamber temperature against time, with the seal temperature limit marked."
              />

              {/* Rehearsal: test any time, which is how engineers work. */}
              <div className="rehearsal">
                <div className="rehearsal-head">Release rehearsal</div>
                <div className="prestart-row">
                  <input
                    className="prestart-input"
                    style={{ fontSize: 15 }}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="t"
                    value={rehearse}
                    onChange={(e) => setRehearse(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && rehearse.trim() !== '') setInspecting(Number(rehearse));
                    }}
                    aria-label="Time to rehearse, in minutes"
                  />
                  <span className="prestart-unit">min</span>
                  <button
                    className="btn btn-sm"
                    disabled={rehearse.trim() === '' || !Number.isFinite(Number(rehearse))}
                    onClick={() => setInspecting(Number(rehearse))}
                  >
                    🔍 Simulate
                  </button>
                </div>
                <p>
                  Simulates what the safety lock would do at a time of your choosing. The air supply
                  expires at {AIR_SUPPLY_MINUTES} min, before the curve reaches its lowest point.
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ----------------------------------------------- consequence simulator */}

      {insp && (
        <Modal title={`Release Rehearsal: t = ${insp.t} min`} onClose={() => setInspecting(null)}>
          <div className="grid-2" style={{ gap: 11, marginBottom: 12 }}>
            <Readout label="Temperature" value={`${insp.temperature}`} unit="°C" tone={insp.tempOk ? 'good' : 'bad'} />
            <Readout label="Rate of change" value={formatRate(insp.rate)} tone={insp.rateOk ? 'good' : 'bad'} />
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <Alert tone={insp.tempOk ? 'ok' : 'bad'} title={`① AT OR BELOW ${SAFE_TEMP_MAX} °C: ${insp.tempOk ? 'PASS' : 'FAIL'}`}>
              {insp.tempOk ? 'Within the seal limit.' : 'The seal warps above the limit and may not pull back.'}
            </Alert>
            <Alert tone={insp.rateOk ? 'ok' : 'bad'} title={`② NOT INCREASING: ${insp.rateOk ? 'PASS' : 'FAIL'}`}>
              {insp.rateOk ? 'Not rising.' : 'Still rising: opening would vent the heat event into the corridor.'}
            </Alert>
            <Alert tone={insp.airOk ? 'ok' : 'bad'} title={`③ AIR AVAILABLE: ${insp.airOk ? 'PASS' : 'FAIL'}`}>
              {insp.airOk
                ? `Inside the ${AIR_SUPPLY_MINUTES} minutes of air she has.`
                : `Her air runs out at ${AIR_SUPPLY_MINUTES} min. Too late, whatever the temperature did.`}
            </Alert>
          </div>

          <div style={{ marginTop: 12 }}>
            <Alert tone={insp.safe ? 'ok' : 'bad'} title={insp.safe ? 'RELEASE PERMITTED' : 'RELEASE REFUSED'}>
              {insp.safe
                ? 'All three conditions hold here. Whether it is the EARLIEST such moment is a different question.'
                : 'The safety lock requires all three simultaneously.'}
            </Alert>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------- other objects */}

      {view === 'window' && (
        <Modal title="Observation Window" onClose={() => setView(null)}>
          <p style={{ marginTop: 0, fontSize: 13.5 }}>
            Dim and fogged with condensation. Dr. Vale sits against the far wall, mask on,
            conscious.
          </p>
          <p style={{ color: 'var(--text-dim)', marginBottom: 0, fontSize: 13.5 }}>
            She sees the light move, points deliberately at the mask, and holds up three fingers.
            She knows how much air she has left.
          </p>
        </Modal>
      )}

      {view === 'airgauge' && (
        <Modal title="Air Supply Indicator" onClose={() => setView(null)}>
          <Readout
            label="C-7 air supply"
            value={AIR_SUPPLY_MINUTES.toFixed(1)}
            unit="min"
            tone="bad"
            note="From the start of manual cooling. Sealed air tank: cannot be extended."
          />
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 12 }}
            onClick={() => {
              dispatch({ type: 'discoverDocument', id: 'air-reserve' });
              setView(null);
              setDoc('air-reserve');
            }}
          >
            📄 Open the life-support specification
          </button>
        </Modal>
      )}

      {view === 'protocolplate' && (
        <Modal title="Protocol Plate" onClose={() => setView(null)}>
          <p style={{ marginTop: 0, color: 'var(--text-dim)', fontSize: 13.5 }}>
            Engraved rather than printed: meant to survive the emergency it describes.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => {
              dispatch({ type: 'discoverDocument', id: 'safety-protocol' });
              dispatch({ type: 'collect', id: 'safetyProtocol' });
              setView(null);
              setDoc('safety-protocol');
            }}
          >
            📙 Read the door opening rules
          </button>
        </Modal>
      )}

      {doc && documentById(doc) && (
        <DocumentModal doc={documentById(doc)!} onClose={() => setDoc(null)} />
      )}
    </StageLayout>
  );
};
