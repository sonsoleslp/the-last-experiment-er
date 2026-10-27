/**
 * Facility ID cards, as actual cards.
 *
 * The personnel number the team needs for the cabinet keypad used to be a line
 * of prose in a dialog ("printed beside the photograph: 417"). Reading a
 * number off a card you are holding is a different experience from being told
 * the number exists, so these are drawn: letterhead, photo, magstripe,
 * barcode, and the number set large enough to be unmistakable.
 *
 * The cards flip. That matters for the badge in particular, because the hint
 * about what the number is FOR is handwritten on the back, exactly where a
 * careless technician would have put it.
 *
 * Accessibility: both faces are always in the DOM and the flip is a labelled
 * toggle button, so a screen reader can reach the back without the animation,
 * and the number is real text rather than part of an image.
 */

import { useState } from 'react';
import { sfx } from '../audio/engine';
import { puzzleForStage } from '../escapp/puzzles';
import { Modal } from './ui';

/**
 * The personnel number is read from the stage 1 puzzle configuration rather
 * than written here, because it IS the stage 1 answer. If the solution in
 * puzzles.ts ever changes, the badge changes with it instead of quietly
 * disagreeing with the cabinet keypad.
 */
const PERSONNEL_NUMBER = puzzleForStage(1).solution;

export type CardKind = 'badge' | 'access';

/**
 * Deterministic barcode bars from a string. Not a real encoding, just a stable
 * pattern so the same card always looks the same.
 */
const bars = (seed: string): number[] => {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 65521;
  return Array.from({ length: 34 }, (_, i) => {
    h = (h * 1103515245 + 12345) % 2147483648;
    return ((h >> (i % 7)) % 3) + 1;
  });
};

const Barcode = ({ seed }: { seed: string }) => {
  let x = 0;
  return (
    <svg className="idcard-barcode" viewBox="0 0 120 22" aria-hidden="true" preserveAspectRatio="none">
      {bars(seed).map((w, i) => {
        const rect = <rect key={i} x={x} y="0" width={w * 0.7} height="22" fill="currentColor" />;
        x += w * 0.7 + 1.1;
        return rect;
      })}
    </svg>
  );
};

/** An abstract ID photo. Deliberately not a depiction of a real person. */
const Portrait = () => (
  <svg className="idcard-photo" viewBox="0 0 60 72" aria-hidden="true">
    <rect width="60" height="72" fill="#141130" />
    <rect width="60" height="72" fill="url(#pg)" />
    <defs>
      <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2ae6ff" stopOpacity="0.14" />
        <stop offset="100%" stopColor="#ff2e88" stopOpacity="0.08" />
      </linearGradient>
    </defs>
    <circle cx="30" cy="27" r="13" fill="#3a3468" />
    <path d="M8 72 Q30 42 52 72 Z" fill="#3a3468" />
    {/* scan lines over the photo, like a printed facility badge */}
    {Array.from({ length: 12 }, (_, i) => (
      <rect key={i} x="0" y={i * 6} width="60" height="1" fill="#04030c" opacity="0.25" />
    ))}
  </svg>
);

const CONTENT: Record<
  CardKind,
  {
    org: string;
    title: string;
    holder: string;
    role: string;
    fieldLabel: string;
    fieldValue: string;
    expires: string;
    stripeNote: string;
    backNote: string;
    handwritten: boolean;
  }
> = {
  badge: {
    org: 'MERIDIAN RESEARCH FACILITY',
    title: 'PERSONNEL IDENTIFICATION',
    holder: 'R. OKONKWO',
    role: 'MAINTENANCE TECHNICIAN · SUBLEVEL 3',
    fieldLabel: 'PERSONNEL No.',
    fieldValue: PERSONNEL_NUMBER,
    expires: 'VALID THRU 09 / 31',
    stripeNote: 'PROPERTY OF MERIDIAN RESEARCH. IF FOUND, RETURN TO SECURITY.',
    backNote: 'Cabinet code = your personnel number',
    handwritten: true,
  },
  access: {
    org: 'MERIDIAN RESEARCH FACILITY',
    title: 'EMERGENCY ACCESS OVERRIDE',
    holder: 'BEARER AUTHORISED',
    role: 'EMERGENCY DOORS · SUBLEVEL 3',
    fieldLabel: 'OVERRIDE CLASS',
    fieldValue: 'E-2',
    expires: 'NO EXPIRY · AUDITED USE',
    stripeNote: 'EVERY USE IS RECORDED.',
    backNote:
      'Opens emergency doors on this floor only. It will not override the chamber door locks.',
    handwritten: false,
  },
};

export const IdCard = ({ kind }: { kind: CardKind }) => {
  const [flipped, setFlipped] = useState(false);
  const c = CONTENT[kind];

  return (
    <div className="idcard-wrap">
      <div className="idcard-scene">
        <div className="idcard" data-flipped={flipped} data-kind={kind}>
          {/* ------------------------------------------------------ front */}
          <div className="idcard-face idcard-front">
            <div className="idcard-head">
              <span className="idcard-org">{c.org}</span>
              <span className="idcard-title">{c.title}</span>
            </div>

            <div className="idcard-body">
              <Portrait />
              <div className="idcard-fields">
                <div className="idcard-holder">{c.holder}</div>
                <div className="idcard-role">{c.role}</div>
                <div className="idcard-number">
                  <span>{c.fieldLabel}</span>
                  <b>{c.fieldValue}</b>
                </div>
              </div>
            </div>

            <div className="idcard-foot">
              <Barcode seed={`${kind}-${c.fieldValue}`} />
              <span>{c.expires}</span>
            </div>
          </div>

          {/* ------------------------------------------------------- back */}
          <div className="idcard-face idcard-back">
            <div className="idcard-stripe" aria-hidden="true" />
            <p className="idcard-smallprint">{c.stripeNote}</p>
            <div className={c.handwritten ? 'idcard-scrawl' : 'idcard-backnote'}>{c.backNote}</div>
            <div className="idcard-foot">
              <span>{c.org}</span>
              <span>{c.fieldValue}</span>
            </div>
          </div>
        </div>
      </div>

      <button
        className="btn btn-ghost btn-sm"
        aria-pressed={flipped}
        onClick={() => {
          sfx('click');
          setFlipped((f) => !f);
        }}
      >
        {flipped ? '↺ Show the front' : '↻ Turn it over'}
      </button>
    </div>
  );
};

const TITLES: Record<CardKind, string> = {
  badge: 'Employee Badge',
  access: 'Emergency Access Card',
};

export const IdCardModal = ({ kind, onClose }: { kind: CardKind; onClose: () => void }) => (
  <Modal title={TITLES[kind]} onClose={onClose}>
    <IdCard kind={kind} />
  </Modal>
);
