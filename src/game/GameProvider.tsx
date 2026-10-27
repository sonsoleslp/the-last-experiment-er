/**
 * GameProvider: owns local exploration state and persists it through Escapp's
 * per-team storage wrapper. See gameState.ts for why this is kept strictly
 * separate from verified progression.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { useEscapp } from '../escapp/EscappProvider';
import {
  GAME_STATE_KEY,
  RUN_MARKER_KEY,
  gameReducer,
  hydrateGameState,
  initialGameState,
  packGameState,
  type GameAction,
  type GameState,
} from './gameState';

interface GameContextValue {
  state: GameState;
  dispatch: (action: GameAction) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export const useGame = (): GameContextValue => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
};

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const { storage, runId, status } = useEscapp();
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  /**
   * Which run we have already loaded state for. Keyed on the run rather than a
   * plain boolean, so that a start time changing mid-session (a teacher
   * restarting the room) is noticed rather than ignored.
   */
  const loadedForRun = useRef<string | null | undefined>(undefined);

  /*
   * Load local state, or wipe it if this is a different run.
   *
   * By the time status is 'ready' the adapter has settled the run id, so a
   * comparison here is meaningful. If the stored marker names a different run,
   * everything the previous team built locally is discarded: otherwise a new
   * team starts in a laboratory with the cabinet already open, the pump
   * already running and the vent valve already spent.
   */
  useEffect(() => {
    if (!storage || status !== 'ready') return;
    if (loadedForRun.current === runId) return;

    try {
      const marker = storage.getSetting(RUN_MARKER_KEY);
      const previousRun = typeof marker === 'string' ? marker : null;
      const isNewRun = previousRun !== null && runId !== null && previousRun !== runId;

      if (isNewRun) {
        storage.removeSetting(GAME_STATE_KEY);
        try {
          sessionStorage.clear();
        } catch {
          /* private browsing */
        }
        dispatch({ type: 'reset' });
      } else {
        const raw = storage.getSetting(GAME_STATE_KEY);
        dispatch({ type: 'hydrate', value: hydrateGameState(raw, runId) });
      }

      storage.saveSetting(RUN_MARKER_KEY, runId);
    } catch (e) {
      console.warn('Game: could not restore local state', e);
    }

    loadedForRun.current = runId;
  }, [storage, status, runId]);

  // Persist on every change, but only after hydration so we never overwrite a
  // saved blob with the defaults on first paint.
  useEffect(() => {
    if (!storage || loadedForRun.current === undefined) return;
    try {
      storage.saveSetting(GAME_STATE_KEY, packGameState(state, runId));
    } catch (e) {
      console.warn('Game: could not persist local state', e);
    }
  }, [state, storage, runId]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
