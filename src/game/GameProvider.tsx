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
  const hydratedRef = useRef(false);

  /*
   * Restore exploration state once Escapp storage AND the run id are known.
   *
   * Waiting for the run id matters: state is discarded unless it belongs to
   * this run and this schema version, which is what stops a previous
   * playthrough's machinery (a spent vent valve, a running pump) leaking into
   * a fresh one. See STATE_VERSION in gameState.ts.
   */
  useEffect(() => {
    if (hydratedRef.current || !storage || status !== 'ready') return;
    hydratedRef.current = true;
    try {
      const raw = storage.getSetting(GAME_STATE_KEY);
      if (raw !== undefined && raw !== null) {
        dispatch({ type: 'hydrate', value: hydrateGameState(raw, runId) });
      }
    } catch (e) {
      console.warn('Game: could not restore local state', e);
    }
  }, [storage, runId, status]);

  // Persist on every change, but only after hydration so we never overwrite a
  // saved blob with the defaults on first paint.
  useEffect(() => {
    if (!storage || !hydratedRef.current) return;
    try {
      storage.saveSetting(GAME_STATE_KEY, packGameState(state, runId));
    } catch (e) {
      console.warn('Game: could not persist local state', e);
    }
  }, [state, storage, runId]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
