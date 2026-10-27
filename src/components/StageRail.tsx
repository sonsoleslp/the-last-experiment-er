/**
 * Mission progress rail. Each node's state comes from Escapp-verified
 * progress, so the rail is an honest picture of what the server has accepted
 * never of what the team believes it has done.
 */

import { useEscapp } from '../escapp/EscappProvider';
import { PUZZLES } from '../escapp/puzzles';

const SHORT: Record<number, string> = {
  1: 'LAB',
  2: 'COOLANT',
  3: 'THERMAL',
  4: 'WINDOW',
  5: 'RELEASE',
};

export const StageRail = () => {
  const { verifiedStages, unlockedStage } = useEscapp();

  return (
    <nav className="rail" aria-label="Mission progress">
      {PUZZLES.map((p, i) => {
        const done = verifiedStages.includes(p.stage);
        const current = !done && p.stage === unlockedStage;
        const state = done ? 'done' : current ? 'current' : 'locked';
        return (
          <span key={p.stage} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && <span className="rail-sep" aria-hidden="true" />}
            <span
              className="rail-node"
              data-state={state}
              aria-label={`Stage ${p.stage}, ${p.title}: ${
                done ? 'complete, verified' : current ? 'in progress' : 'locked'
              }`}
            >
              <span className="dot" aria-hidden="true" />
              {p.stage}. {SHORT[p.stage]}
              {done && <span aria-hidden="true">✓</span>}
              {state === 'locked' && <span aria-hidden="true">🔒</span>}
            </span>
          </span>
        );
      })}
    </nav>
  );
};
