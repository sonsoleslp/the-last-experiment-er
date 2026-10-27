/** Shared presentational primitives for the facility interface. */

import { useEffect, useRef, type ReactNode } from 'react';

/* ------------------------------------------------------------------ modal */

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  /** Rendered bare, without the panel chrome (used for paper documents). */
  bare?: boolean;
}

/**
 * Accessible modal: focus moves in on open, Escape closes, focus is trapped
 * inside while open and returned to the trigger on close.
 *
 * The two effects below are deliberately mount-only, and `onClose` is read
 * through a ref rather than listed as a dependency. Callers pass it as an
 * inline arrow (`onClose={() => setView(null)}`), which has a fresh identity
 * on every render, so depending on it re-ran this effect after every
 * keystroke, and the `ref.current.focus()` on re-entry yanked focus out of
 * whatever input the player was typing in. That made the pre-start and
 * rate-declaration fields impossible to type into.
 */
export const Modal = ({ title, onClose, children, wide, bare }: ModalProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Initial focus and focus restoration: once per open/close, never on update.
  useEffect(() => {
    returnTo.current = document.activeElement;
    ref.current?.focus();
    return () => {
      (returnTo.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const focusable = ref.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onCloseRef.current()}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? 'modal-wide' : ''} ${bare ? '' : 'panel'}`}
      >
        {!bare && (
          <div className="panel-head">
            <h3>{title}</h3>
            <button className="modal-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        )}
        {bare ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>
                ✕ Close
              </button>
            </div>
            {children}
          </>
        ) : (
          <div className="panel-body">{children}</div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ alert */

export type Tone = 'ok' | 'warn' | 'bad' | 'info';

const TONE_GLYPH: Record<Tone, string> = { ok: '✓', warn: '!', bad: '✕', info: 'i' };
const TONE_WORD: Record<Tone, string> = {
  ok: 'Success',
  warn: 'Caution',
  bad: 'Alert',
  info: 'Information',
};

/** Status is carried by a glyph and a word, never by colour alone. */
export const Alert = ({
  tone,
  title,
  children,
}: {
  tone: Tone;
  title: string;
  children?: ReactNode;
}) => (
  <div className="alert" data-tone={tone} role={tone === 'bad' ? 'alert' : 'status'}>
    <span className="alert-icon" aria-hidden="true">
      {TONE_GLYPH[tone]}
    </span>
    <div>
      <b>
        <span className="sr-only">{TONE_WORD[tone]}: </span>
        {title}
      </b>
      {children}
    </div>
  </div>
);

/* ------------------------------------------------------------------- chip */

export const Chip = ({ tone, children }: { tone?: Tone; children: ReactNode }) => (
  <span className="chip" data-tone={tone}>
    {children}
  </span>
);

/* ---------------------------------------------------------------- readout */

export const Readout = ({
  label,
  value,
  unit,
  tone,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'good' | 'warn' | 'bad';
  note?: string;
}) => (
  <div className="readout">
    <div className="readout-label">{label}</div>
    <div className={`readout-value ${tone ? `is-${tone}` : ''}`}>
      {value}
      {unit && <span className="readout-unit">{unit}</span>}
    </div>
    {note && (
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>{note}</div>
    )}
  </div>
);
