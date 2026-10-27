/**
 * The "stage solved" notification, shared by everyone on the team.
 *
 * There is one source for this text, used by the person who solved the puzzle
 * and by every teammate who receives the progress. That is the point: a
 * teammate should see exactly what the solver saw, not a different "your team
 * moved on" message, and certainly not a modal dialog interrupting them.
 *
 * Every message is derived from the model rather than from local interface
 * state, so each browser produces identical wording without needing to be told
 * what happened.
 */

import type { ToastData } from '../components/Toast';
import {
  MIN_FLOW,
  Q,
  SENSOR_READING_MINUTE,
  T,
  VENT_HOLDS,
  dT,
  earliestSafeRelease,
  formatPressureRate,
  formatRate,
  pressureFallRate,
  validPumpSettings,
} from './model';

export const stageSolvedToast = (stage: number): ToastData | null => {
  switch (stage) {
    case 1:
      return {
        tone: 'ok',
        title: 'CABINET OPEN',
        body: 'The latch retracts. Inside is a red-striped emergency access card, and it opens the door to the cooling room.',
      };
    case 2: {
      const x = validPumpSettings()[0];
      return {
        tone: 'ok',
        title: 'COOLANT FLOWING',
        body: `Dial setting ${x} gives ${Q(x)} L/min, above the ${MIN_FLOW} L/min minimum. The flow is steady and loop B is running.`,
      };
    }
    case 3:
      return {
        tone: 'ok',
        title: 'COOLING LEFT ALONE: STEADY',
        body: `At ${formatRate(dT(SENSOR_READING_MINUTE))} the chamber is cooling gently, inside the shock limit. It keeps falling along the predicted curve and Dr. Vale still has her air.`,
      };
    case 4: {
      const t = earliestSafeRelease();
      if (t === null) return null;
      return {
        tone: 'ok',
        title: `DOOR TIME AGREED: ${t} MIN`,
        body: `At ${t} minutes the chamber is ${T(t)} °C, still falling, and she still has air. All three rules hold. The release system is armed.`,
      };
    }
    case 5: {
      const hold = VENT_HOLDS[VENT_HOLDS.length - 1];
      return {
        tone: 'ok',
        title: 'DOOR OPEN',
        body: `At ${hold} kPa the pressure was falling at ${formatPressureRate(pressureFallRate(hold))}, slow enough for the motor. The wedges pulled back and the chamber is open.`,
      };
    }
    default:
      return null;
  }
};
