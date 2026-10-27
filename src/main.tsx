import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { EscappProvider } from './escapp/EscappProvider';
import { GameProvider } from './game/GameProvider';
import './styles/index.css';
import './styles/components.css';

// EscappProvider boots the Escapp client and owns verified progression.
// GameProvider owns local exploration state and persists it through Escapp's
// per-team storage. The order matters: the game needs Escapp's storage.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EscappProvider>
      <GameProvider>
        <App />
      </GameProvider>
    </EscappProvider>
  </StrictMode>,
);
