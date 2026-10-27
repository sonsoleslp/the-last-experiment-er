/**
 * Local exploration state for THE LAST EXPERIMENT.
 *
 * This is deliberately NOT the source of truth for progression. It records
 * what the team has looked at, picked up and configured; the interface state
 * that makes the room feel continuous. Stage unlocking comes exclusively from
 * Escapp (see EscappProvider.verifiedStages).
 *
 * Escapp has no API for synchronising arbitrary application state, so this
 * state is persisted into Escapp's own per-team localStorage wrapper
 * (`escapp.getStorage()`) under a single key. Consequences, documented
 * deliberately:
 *  - it survives refresh and reconnection for the same browser;
 *  - it is per-device, so two teammates each keep their own exploration
 *    state while sharing Escapp-verified stage progress.
 * That trade-off is acceptable because nothing gated lives here: a teammate
 * who joins late sees the correct stage and can re-open any document.
 */

import { INTERVENTIONS, type Intervention } from './model';

export type ItemId = 'badge' | 'accessCard' | 'notebook' | 'calibrationReport' | 'safetyProtocol' | 'containmentProtocol';

export interface GameState {
  /** Hotspot ids the team has inspected, for "seen" styling. */
  inspected: string[];
  /** Inventory item ids collected. */
  inventory: ItemId[];
  /** Document ids discovered, re-readable from the case file at any time. */
  documents: string[];
  /** Stage 1: cabinet lock opened (local; stage 1 is verified by Escapp). */
  cabinetOpen: boolean;
  /** Stage 2: current regulator position the player has dialled in. */
  pumpSetting: number;
  /** Stage 2: pump activated and holding. */
  pumpRunning: boolean;
  /**
   * Stage 2; the flow log: settings actually started, and what they
   * delivered. This is the only data the flow graph plots, which is why the
   * graph cannot be used to read off the maximum.
   */
  flowLog: { x: number; flow: number }[];
  /**
   * Stage 3; the trend channel has been restored by manual entry. Until this
   * is true the intervention controls stay locked, so the choice can never be
   * a coin flip.
   */
  trendRestored: boolean;
  /** Stage 3: intervention the team committed to, if any. */
  intervention: Intervention | null;
  /** Stage 4: release minute the team proposed. */
  proposedRelease: number | null;
  /**
   * Stage 5: how many vent cycles have been run. 0 = valve still shut,
   * 1 = holding at the first pressure, 2 = holding at the second (vent charge
   * spent).
   */
  ventCycles: number;
  /** Stage 5: actuator released by a validated rate declaration. */
  actuatorArmed: boolean;
  /** Per-stage count of rejected attempts. Kept for the teacher's debrief. */
  failedAttempts: Record<number, number>;
  /** Intro briefing has been dismissed. */
  briefingSeen: boolean;
}

export const initialGameState: GameState = {
  inspected: [],
  inventory: [],
  documents: [],
  cabinetOpen: false,
  pumpSetting: 0,
  pumpRunning: false,
  flowLog: [],
  trendRestored: false,
  intervention: null,
  proposedRelease: null,
  ventCycles: 0,
  actuatorArmed: false,
  failedAttempts: {},
  briefingSeen: false,
};

export type GameAction =
  | { type: 'inspect'; id: string }
  | { type: 'collect'; id: ItemId }
  | { type: 'discoverDocument'; id: string }
  | { type: 'openCabinet' }
  | { type: 'setPump'; value: number }
  | { type: 'setPumpRunning'; value: boolean }
  | { type: 'logFlow'; x: number; flow: number }
  | { type: 'restoreTrend' }
  | { type: 'setIntervention'; value: Intervention | null }
  | { type: 'proposeRelease'; value: number | null }
  | { type: 'vent' }
  | { type: 'armActuator'; value: boolean }
  | { type: 'recordFailure'; stage: number }
  | { type: 'seeBriefing' }
  | { type: 'hydrate'; value: GameState }
  | { type: 'reset' };

const addOnce = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list : [...list, value];

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'inspect':
      return { ...state, inspected: addOnce(state.inspected, action.id) };
    case 'collect':
      return { ...state, inventory: addOnce(state.inventory, action.id) };
    case 'discoverDocument':
      return { ...state, documents: addOnce(state.documents, action.id) };
    case 'openCabinet':
      return { ...state, cabinetOpen: true };
    case 'setPump':
      return { ...state, pumpSetting: action.value, pumpRunning: false };
    case 'setPumpRunning':
      return { ...state, pumpRunning: action.value };
    case 'logFlow':
      return state.flowLog.some((e) => e.x === action.x)
        ? state
        : { ...state, flowLog: [...state.flowLog, { x: action.x, flow: action.flow }] };
    case 'restoreTrend':
      return { ...state, trendRestored: true };
    case 'setIntervention':
      return { ...state, intervention: action.value };
    case 'proposeRelease':
      return { ...state, proposedRelease: action.value };
    case 'vent':
      // The vent charge permits two cycles; there is no third guess.
      return state.ventCycles >= 2
        ? state
        : { ...state, ventCycles: state.ventCycles + 1, actuatorArmed: false };
    case 'armActuator':
      return { ...state, actuatorArmed: action.value };
    case 'recordFailure':
      return {
        ...state,
        failedAttempts: {
          ...state.failedAttempts,
          [action.stage]: (state.failedAttempts[action.stage] ?? 0) + 1,
        },
      };
    case 'seeBriefing':
      return { ...state, briefingSeen: true };
    case 'hydrate':
      return action.value;
    case 'reset':
      return initialGameState;
    default:
      return state;
  }
};

export const GAME_STATE_KEY = 'TLE_GAME_STATE';

/**
 * The run this stored state belongs to, kept as its own key.
 *
 * Escapp identifies a run by the escape room's start time. When a new team
 * starts, that changes, and everything the previous team built locally must go:
 * otherwise the new team walks into an open cabinet, a running pump and a
 * spent vent valve.
 *
 * The Escapp client has its own mechanism for this (it fires
 * onErRestartCallback when the start time changes), but it cannot be the only
 * line of defence. It early-returns in preview mode, and it only fires when the
 * client happens to be told about the new state. Comparing this marker on every
 * boot is independent of all that.
 */
export const RUN_MARKER_KEY = 'TLE_RUN_ID';

/**
 * Schema version of the persisted blob. BUMP THIS whenever a field changes
 * meaning, not just when one is added or removed.
 *
 * This exists because of a real bug. `ventCycles` (how many vent bursts the
 * team has used in stage 5) was persisted with no version and no run scope, so
 * a value left behind by an earlier playthrough, or by a build with different
 * vent constants, made the final stage open with the valve already spent. The
 * player arrived at a gauge reading they had not produced, missed the first
 * hold entirely, and was told "vent charge spent" before touching anything.
 *
 * Anything that is not this exact version is discarded rather than migrated.
 * Nothing here gates a stage, so throwing it away costs a team nothing beyond
 * re-opening a document.
 */
export const STATE_VERSION = 3;

/** What actually goes into storage. */
export interface PersistedGameState {
  v: number;
  /**
   * Identifies the run this state belongs to (Escapp's escape-room start
   * time). State from a different run is discarded, so replaying a room starts
   * genuinely fresh instead of inheriting the last team's machinery.
   */
  runId: string | null;
  state: GameState;
}

export const packGameState = (state: GameState, runId: string | null): PersistedGameState => ({
  v: STATE_VERSION,
  runId,
  state,
});

/**
 * Field-by-field normalisation. A tampered or stale blob degrades to defaults
 * instead of crashing, and because nothing here gates a stage, tampering with
 * it cannot unlock anything.
 */
export const normaliseGameState = (raw: unknown): GameState => {
  if (typeof raw !== 'object' || raw === null) return initialGameState;
  const blob = raw as Partial<GameState>;
  const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
  const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const rec = (v: unknown): Record<number, number> =>
    typeof v === 'object' && v !== null ? (v as Record<number, number>) : {};

  return {
    inspected: arr<string>(blob.inspected, []),
    inventory: arr<ItemId>(blob.inventory, []),
    documents: arr<string>(blob.documents, []),
    cabinetOpen: blob.cabinetOpen === true,
    pumpSetting: num(blob.pumpSetting, 0),
    pumpRunning: blob.pumpRunning === true,
    flowLog: arr<{ x: number; flow: number }>(blob.flowLog, []).filter(
      (e) => typeof e?.x === 'number' && typeof e?.flow === 'number',
    ),
    trendRestored: blob.trendRestored === true,
    intervention: INTERVENTIONS.includes(blob.intervention as Intervention)
      ? (blob.intervention as Intervention)
      : null,
    proposedRelease: typeof blob.proposedRelease === 'number' ? blob.proposedRelease : null,
    ventCycles: Math.max(0, Math.min(2, num(blob.ventCycles, 0))),
    actuatorArmed: blob.actuatorArmed === true,
    failedAttempts: rec(blob.failedAttempts),
    briefingSeen: blob.briefingSeen === true,
  };
};

/**
 * Read persisted state, discarding anything that does not belong to this
 * schema version and this run. See STATE_VERSION for why.
 */
export const hydrateGameState = (raw: unknown, runId: string | null): GameState => {
  if (typeof raw !== 'object' || raw === null) return initialGameState;
  const env = raw as Partial<PersistedGameState>;
  // An un-versioned blob is from before this envelope existed: discard it.
  if (env.v !== STATE_VERSION) return initialGameState;
  if ((env.runId ?? null) !== runId) return initialGameState;
  return normaliseGameState(env.state);
};
