/**
 * Custom three-digit combination lock for the stage 1 storage cabinet.
 *
 * Built from scratch (no reusable Escapp puzzle). The entered code is sent to
 * Escapp for verification; the cabinet only opens on a verified verdict, so a
 * player who edits local storage still cannot open it.
 */

import { useEffect, useState } from 'react';
import { sfx } from '../audio/engine';
import { Alert } from './ui';

interface Props {
  /** Verify the entered code. Resolves with the server's verdict. */
  onSubmit: (code: string) => Promise<{ verified: boolean; reachedServer: boolean; error?: string }>;
  onOpened: () => void;
  disabled?: boolean;
}

export const CombinationLock = ({ onSubmit, onOpened, disabled }: Props) => {
  const [digits, setDigits] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'checking' | 'rejected' | 'offline' | 'open'>('idle');
  const [error, setError] = useState<string | null>(null);

  const push = (d: string) => {
    if (state === 'checking' || state === 'open' || digits.length >= 3) return;
    setState('idle');
    sfx('key');
    setDigits([...digits, d]);
  };
  const clear = () => {
    if (state === 'checking' || state === 'open') return;
    setDigits([]);
    setState('idle');
    setError(null);
    sfx('click');
  };

  const submit = async () => {
    if (digits.length !== 3 || state === 'checking') return;
    setState('checking');
    setError(null);
    const result = await onSubmit(digits.join(''));
    if (!result.reachedServer) {
      setState('offline');
      sfx('warn');
      setError(result.error ?? 'The code could not be verified right now.');
      return;
    }
    if (result.verified) {
      setState('open');
      sfx('latch');
      onOpened();
    } else {
      setState('rejected');
      sfx('reject');
      setDigits([]);
    }
  };

  // Physical keypads accept the number row, so does this one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled || state === 'open') return;
      if (/^[0-9]$/.test(e.key)) push(e.key);
      else if (e.key === 'Backspace') clear();
      else if (e.key === 'Enter' && digits.length === 3) void submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="keypad" data-shake={state === 'rejected'}>
        <div
          className="keypad-display"
          role="status"
          aria-label={`Entered ${digits.length} of 3 digits: ${digits.join(' ') || 'none'}`}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="keypad-digit" data-empty={digits[i] === undefined}>
              {digits[i] ?? '–'}
            </div>
          ))}
        </div>

        <div className="keypad-grid">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              className="keypad-key"
              onClick={() => push(d)}
              disabled={disabled || state === 'checking' || state === 'open'}
              aria-label={`Digit ${d}`}
            >
              {d}
            </button>
          ))}
          <button
            className="keypad-key"
            onClick={clear}
            disabled={disabled || state === 'checking' || state === 'open'}
            aria-label="Clear entry"
          >
            ⌫
          </button>
          <button
            className="keypad-key"
            onClick={() => push('0')}
            disabled={disabled || state === 'checking' || state === 'open'}
            aria-label="Digit 0"
          >
            0
          </button>
          <button
            className="keypad-key"
            onClick={() => void submit()}
            disabled={disabled || digits.length !== 3 || state === 'checking' || state === 'open'}
            aria-label="Enter code"
            style={{ color: 'var(--green)' }}
          >
            ⏎
          </button>
        </div>
      </div>

      {state === 'checking' && <Alert tone="info" title="Verifying code…" />}
      {state === 'rejected' && (
        <Alert tone="bad" title="CODE REJECTED">
          The cabinet lock does not accept that combination. Three digits, from facility records.
        </Alert>
      )}
      {state === 'offline' && (
        <Alert tone="warn" title="VERIFICATION UNAVAILABLE">
          {error} The cabinet stays locked until your code can be checked.
        </Alert>
      )}
      {state === 'open' && (
        <Alert tone="ok" title="CABINET OPEN">
          The latch pull backs. Inside: a single emergency access card.
        </Alert>
      )}
    </div>
  );
};
