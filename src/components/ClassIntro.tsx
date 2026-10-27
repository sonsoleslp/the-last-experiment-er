/**
 * The classroom display: the cinematic, replayable, and nothing else.
 *
 * Rendered outside the Escapp and game providers, so no client is created and
 * no sign-in can appear. See src/classroom.ts.
 *
 * When the cinematic ends it offers to play again rather than entering the
 * game, because in this mode there is no authenticated team and therefore no
 * game to enter. The card says so plainly, so nobody projects this expecting
 * to play from it.
 */

import { useState } from 'react';
import { Intro } from './Intro';
import { Chip } from './ui';

export const ClassIntro = () => {
  /** Bumping this remounts the cinematic, which replays it from the top. */
  const [run, setRun] = useState(0);
  const [finished, setFinished] = useState(false);

  if (finished) {
    return (
      <div className="app-shell">
        <div className="scene">
          <div className="boot-screen">
            <Chip tone="info">Classroom display</Chip>
            <h1>BRIEFING COMPLETE</h1>
            <p>
              Teams can now open the escape room on their own machines and sign in to Escapp. This
              screen is the briefing only: it records nothing and cannot be played from.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                setFinished(false);
                setRun((n) => n + 1);
              }}
            >
              ↻ Play the briefing again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Intro key={run} onFinish={() => setFinished(true)} />;
};
