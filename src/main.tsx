import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyResetHatch } from './resetHatch';
import { ClassIntro } from './components/ClassIntro';
import { isClassroomMode } from './classroom';
import { EscappProvider } from './escapp/EscappProvider';
import { GameProvider } from './game/GameProvider';
import './styles/index.css';
import './styles/components.css';

/*
 * `?reset=1` wipes everything this browser remembers and starts clean. It runs
 * first, before the Escapp client is ever constructed, because the client
 * reads its cached state the moment it is created. See src/resetHatch.ts for
 * why this manual lever is needed at all.
 */
applyResetHatch();

const root = createRoot(document.getElementById('root')!);

/*
 * Two entry points.
 *
 * `?interface=class` is the classroom display: the cinematic on a projector,
 * with no Escapp session and no sign-in. It is mounted OUTSIDE the providers
 * on purpose. Hiding the game inside the tree would not be enough, because
 * EscappProvider boots the client as soon as it mounts, and the client would
 * then put an authentication dialog up on the projector.
 *
 * Otherwise: EscappProvider boots the Escapp client and owns verified
 * progression, and GameProvider owns local exploration state and persists it
 * through Escapp's per-team storage. The order matters, because the game needs
 * Escapp's storage.
 */
root.render(
  <StrictMode>
    {isClassroomMode() ? (
      <ClassIntro />
    ) : (
      <EscappProvider>
        <GameProvider>
          <App />
        </GameProvider>
      </EscappProvider>
    )}
  </StrictMode>,
);
