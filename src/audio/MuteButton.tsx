/**
 * Sound toggle, in the top bar.
 *
 * Sound is on by default because the ambience is part of the experience, but a
 * room of thirty laptops is a real consideration, so the control is always
 * one click away and the choice persists per browser.
 */

import { useState } from 'react';
import { isMuted, setMuted, sfx } from './engine';

export const MuteButton = () => {
  const [muted, setLocal] = useState(isMuted());

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    setLocal(next);
    if (!next) sfx('click');
  };

  return (
    <button
      className="mute-btn"
      onClick={toggle}
      aria-pressed={muted}
      aria-label={muted ? 'Sound off. Turn sound on.' : 'Sound on. Turn sound off.'}
      title={muted ? 'Sound off' : 'Sound on'}
    >
      <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
      <span className="mute-label">{muted ? 'OFF' : 'ON'}</span>
    </button>
  );
};
