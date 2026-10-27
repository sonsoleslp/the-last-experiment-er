/**
 * STAGE 3: AVERAGE RATE vs INSTANTANEOUS RATE
 *
 * The distinct idea here is the difference between a chord and a tangent, and
 * it is made to matter rather than merely stated.
 *
 * The dead sensor left two logged readings: 30 deg C at t = 0 and 18 deg C at
 * t = 2. The obvious thing to do with two readings is divide the difference,
 * which gives -6 deg C/min. That is the average over the interval, not the
 * rate at this moment, and rule TH-9 has three branches with a thermal
 * shock limit at 5 deg C/min:
 *
 *   chord   -6 deg C/min  ->  |−6| > 5  ->  REDUCE COOLANT FLOW   (wrong)
 *   tangent -4 deg C/min  ->  |−4| <= 5 ->  MAINTAIN COOLING      (right)
 *
 * So the two rates lead to different ACTIONS. A team that averages does not
 * get a near miss, they get the wrong call, and the console tells them exactly
 * which quantity they computed. The console shows the logged average in plain
 * sight, because the temptation is the lesson.
 *
 * Three branches also means the decision is not a coin flip even before the
 * rate is entered.
 */


import { useState } from 'react';
import { DocumentModal } from '../components/DocumentView';
import { FunctionGraph } from '../components/FunctionGraph';
import type { HotspotDef } from '../components/Hotspot';
import { sfx } from '../audio/engine';
import { ProceedBar } from '../components/ProceedBar';
import { SceneStrip } from '../components/SceneStrip';
import { ThermalScene } from '../components/RoomScene';
import { StageLayout } from '../components/StageLayout';
import { Toast, type ToastData } from '../components/Toast';
import { Alert, Modal, Readout } from '../components/ui';
import { useEscapp } from '../escapp/EscappProvider';
import { documentById } from '../game/documents';
import { useGame } from '../game/GameProvider';
import {
  INTERVENTIONS,
  SENSOR_LOG_START,
  SENSOR_READING_MINUTE,
  SHOCK_LIMIT,
  T,
  averageRate,
  dT,
  formatRate,
  rateMatches,
  type Intervention,
} from '../game/model';

const HOTSPOTS: HotspotDef[] = [
  { id: 'tempdisplay', label: 'Temperature Display', description: 'The chamber thermometer channel, showing a live temperature.', x: 12, y: 29, w: 21, h: 25 },
  { id: 'trendsensor', label: 'Rate Sensor', description: 'The temperature rate sensor. Flashing a fault, showing no value.', x: 38, y: 29, w: 21, h: 25 },
  { id: 'console', label: 'Intervention Controls', description: 'The operator console with the two rule TH-9 interventions.', x: 30, y: 62, w: 40, h: 16 },
  { id: 'thermalbinder', label: 'Thermal Binder', description: 'A red binder on the console: the chamber thermal monitoring file.', x: 15, y: 54, w: 4, h: 5 },
];

const t0 = SENSOR_READING_MINUTE;
const tPrev = SENSOR_LOG_START;
/** The gradient of the chord through the two logged readings. */
const LOGGED_AVERAGE = averageRate(tPrev, t0);

const ACTIONS: Record<Intervention, { glyph: string; label: string; sub: string; danger?: boolean }> = {
  MAINTAIN: {
    glyph: '❄',
    label: 'MAINTAIN COOLING',
    sub: 'Let the cooling continue at the present flow.',
  },
  REDUCE_FLOW: {
    glyph: '▼',
    label: 'REDUCE COOLANT FLOW',
    sub: `Cut back flow. For cooling faster than ${SHOCK_LIMIT} °C/min.`,
    danger: true,
  },
  SUPPRESSION: {
    glyph: '🔥',
    label: 'EMERGENCY COOLING GAS',
    sub: 'Flood the chamber with cold gas. For a heating chamber.',
    danger: true,
  },
};

export const Stage3Thermal = ({ onAdvance }: { onAdvance: () => void }) => {
  const { state, dispatch } = useGame();
  const { submitStage, verifiedStages, status } = useEscapp();
  const [view, setView] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [busy, setBusy] = useState(false);
  /** The operator's entered rate of change, as typed. */
  const [enteredRate, setEnteredRate] = useState('');

  const verified = verifiedStages.includes(3);
  const stabilised = verified && state.intervention === 'MAINTAIN';
  const trendRestored = state.trendRestored;

  const open = (id: string) => {
    sfx('click');
    setView(id);
    dispatch({ type: 'inspect', id });
  };

  /**
   * Restore the dead rate sensor by manual entry. Validated against the
   * formula; a mismatch leaks nothing except that it is wrong.
   */
  const restoreChannel = () => {
    const value = Number(enteredRate.trim());
    if (enteredRate.trim() === '' || !rateMatches(t0, value)) {
      dispatch({ type: 'recordFailure', stage: 3 });
      setToast({
        tone: 'warn',
        title: 'NUMBER REFUSED',
        body:
          enteredRate.trim() === ''
            ? `Enter the rate of temperature change at t = ${t0} min, in °C per minute, to restore the channel.`
            : Math.abs(value - LOGGED_AVERAGE) < 0.25
              ? `${value} °C/min is the AVERAGE rate across the logged interval from t = ${tPrev} to t = ${t0} min, not the rate at this instant. The cooling is curved, so the two differ. The channel needs the rate right now.`
              : `${value} °C/min does not match the chamber formula at t = ${t0} min. Check your working, and check the sign.`,
      });
      return;
    }
    dispatch({ type: 'restoreTrend' });
    setToast({
      tone: 'ok',
      title: 'READING RESTORED',
      body: `Channel reads ${formatRate(dT(t0))} at t = ${t0} min. Intervention controls released: apply rule TH-9.`,
    });
  };

  const intervene = async (choice: Intervention) => {
    setBusy(true);
    setToast(null);
    dispatch({ type: 'setIntervention', value: choice });

    const result = await submitStage(3, choice);
    setBusy(false);
    setView(null);

    if (!result.reachedServer) {
      dispatch({ type: 'setIntervention', value: null });
      setToast({
        tone: 'warn',
        title: 'INTERVENTION NOT CONFIRMED',
        body: `${result.error ?? 'The facility network is not responding.'} Nothing was logged: try again.`,
      });
      return;
    }

    if (result.verified) {
      // Raised by the shell, so teammates see the identical message.
      setToast(null);
      return;
    }

    dispatch({ type: 'recordFailure', stage: 3 });
    dispatch({ type: 'setIntervention', value: null });

    // Each wrong branch fails for its own physical reason, and the commonest
    // of them is the one you reach by averaging.
    if (choice === 'REDUCE_FLOW') {
      setToast({
        tone: 'bad',
        title: 'FLOW REDUCTION REFUSED',
        body: `Cutting flow would drop loop B below the ${'22'} L/min emergency minimum you established, and the chamber would never reach safe limits. TH-9 only calls for that when cooling exceeds ${SHOCK_LIMIT} °C/min. At this instant it does not. Check whether the figure you used was the rate now or the average over an interval.`,
      });
    } else {
      setToast({
        tone: 'bad',
        title: 'COOLING GAS STOPPED',
        body: 'The safety lock stopped the gas. Rule TH-9 only allows the cooling gas when a chamber is HEATING UP. Flooding a chamber that is already cooling stops the cooling and burns air she cannot spare.',
      });
    }
  };

  return (
    <StageLayout
      stage={3}
      objective={
        verified
          ? 'Cooling maintained. The cooling is stable.'
          : trendRestored
            ? 'Channel restored. Apply rule TH-9.'
            : 'The rate sensor is dead. Restore it to unlock the controls.'
      }
      stats={[
        { label: 'C-7', value: `${T(t0).toFixed(0)}°C`, tone: 'warn' },
        {
          label: 'TREND',
          value: trendRestored ? formatRate(dT(t0)).replace(' °C/min', '') : 'FAULT',
          tone: trendRestored ? 'ok' : 'bad',
        },
        { label: 'LOG AVG', value: `${LOGGED_AVERAGE.toFixed(1)}`, tone: 'warn' },
        { label: 'SHOCK LIM', value: `${SHOCK_LIMIT}` },
      ]}
      scene={<ThermalScene stabilised={stabilised} />}
      hotspots={HOTSPOTS}
      seen={state.inspected}
      onHotspot={open}
    >
      <SceneStrip>
        {toast && <Toast data={toast} onClose={() => setToast(null)} />}
        <ProceedBar verified={verified} ready={verified} label="Proceed to chamber C-7" onProceed={onAdvance} />
      </SceneStrip>

      {/* ------------------------------------------- the intervention console */}

      {view === 'console' && (
        <Modal title="Rule TH-9: What To Do" onClose={() => setView(null)} wide>
          <div className="grid-2" style={{ gap: 16 }}>
            <div>
              <FunctionGraph
                f={T}
                df={dT}
                domain={[0, 8]}
                range={[12, 32]}
                xLabel="t (minutes of manual cooling)"
                yLabel="T (°C)"
                tangentAt={t0}
                markers={[{ x: t0, label: `t = ${t0}` }]}
                caption="Chamber temperature against time, reconstructed from the thermal test report."
              />
              <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '8px 0 0' }}>
                Reconstructed from the test report. The dashed line is the slope at the current
                reading; the trend the failed sensor should have reported.
              </p>
            </div>

            <div style={{ display: 'grid', gap: 11, alignContent: 'start' }}>
              {/* The channel-restoration safety lock. */}
              {!trendRestored ? (
                <div className="prestart">
                  <label className="prestart-label" htmlFor="entered-rate">
                    Switch the reading back on: rate of change at t = {t0} min
                  </label>
                  <div className="prestart-row">
                    <input
                      id="entered-rate"
                      className="prestart-input"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      placeholder="––"
                      value={enteredRate}
                      disabled={busy || verified}
                      onChange={(e) => {
                        setEnteredRate(e.target.value);
                        setToast(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') restoreChannel();
                      }}
                      aria-describedby="rate-help"
                    />
                    <span className="prestart-unit">°C/min</span>
                  </div>
                  <p id="rate-help" className="prestart-help">
                    Validated against the chamber formula. Sign is significant.
                  </p>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', marginTop: 9 }}
                    disabled={busy || verified}
                    onClick={restoreChannel}
                  >
                    Switch it back on
                  </button>
                </div>
              ) : (
                <div className="channel-ok">
                  <span aria-hidden="true">✓</span>
                  <p>
                    Rate sensor reads <strong className="mono">{formatRate(dT(t0))}</strong> at
                    t = {t0} min.
                  </p>
                </div>
              )}

              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-dim)' }}>
                {trendRestored
                  ? `Rule TH-9 branches on the direction AND the size of the trend. Shock limit ${SHOCK_LIMIT} °C/min.`
                  : 'The intervention controls stay locked until the channel is restored.'}
              </p>

              {INTERVENTIONS.map((key) => {
                const a = ACTIONS[key];
                return (
                  <button
                    key={key}
                    className={`btn ${a.danger ? 'btn-danger' : ''}`}
                    style={{ padding: '13px 15px', justifyContent: 'flex-start' }}
                    disabled={!trendRestored || busy || verified || status === 'unsupported'}
                    onClick={() => void intervene(key)}
                  >
                    <span style={{ display: 'grid', gap: 2, textAlign: 'left' }}>
                      <strong style={{ letterSpacing: '0.07em' }}>
                        {a.glyph} {a.label}
                      </strong>
                      <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--text-dim)' }}>
                        {a.sub}
                      </span>
                    </span>
                  </button>
                );
              })}

              {busy && <Alert tone="info" title="Command sent to the safety system…" />}
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------- other objects */}

      {view === 'thermalbinder' && (
        <Modal title="Thermal Monitoring Binder" onClose={() => setView(null)}>
          <div style={{ display: 'grid', gap: 9 }}>
            {['thermal-model', 'safety-protocol'].map((id) => {
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
                  <span aria-hidden="true" style={{ fontSize: 19 }}>{d.kind === 'protocol' ? '📕' : '📄'}</span>
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

      {view === 'tempdisplay' && (
        <Modal title="Temperature Display" onClose={() => setView(null)}>
          <Readout
            label={`Chamber C-7 · t = ${t0} min`}
            value={T(t0).toFixed(1)}
            unit="°C"
            tone="warn"
            note="One reading, taken at one moment. It is accurate, and it tells you nothing about which way the temperature is going."
          />
        </Modal>
      )}

      {view === 'trendsensor' && (
        <Modal title="Rate Sensor" onClose={() => setView(null)}>
          {trendRestored ? (
            <Alert tone="ok" title={`READING RESTORED: ${formatRate(dT(t0))}`}>
              Reading entered manually by the responding operator and validated against the
              formula.
            </Alert>
          ) : (
            <Alert tone="bad" title="CHANNEL FAULT; NO DATA">
              The hardware cannot be repaired while the sublevel is sealed. Rule TH-9 permits
              manual restoration from the formula instead.
            </Alert>
          )}
          <p style={{ color: 'var(--text-dim)', marginTop: 12, marginBottom: 0, fontSize: 13.5 }}>
            Handwritten on the maintenance tag:{' '}
            <strong className="mono">
              If this dies, the model is in the binder. You can get the trend from the model.
            </strong>
          </p>
        </Modal>
      )}

      {doc && documentById(doc) && (
        <DocumentModal doc={documentById(doc)!} onClose={() => setDoc(null)} />
      )}
    </StageLayout>
  );
};
