/**
 * STAGE 1; THE LOCKED LABORATORY
 *
 * Deliberately the simplest stage in the game: no mathematics, no side
 * puzzles, and a single obvious chain of four actions
 *
 *   computer (what happened)  ->  desk (badge 417)
 *     ->  cabinet keypad (417)  ->  door (access card)
 *
 * Its whole job is to set the situation and teach the interaction vocabulary
 * (click an object, read a document, use the keypad, carry an item). The HUD
 * objective line names the next action at all times, so nobody can get stuck
 * hunting pixels. Flavour objects stay in the artwork but are not clickable
 * an earlier version had seven hotspots and two optional documents here, which
 * made the opening feel like homework before the game had started.
 */

import { useState } from 'react';
import { CombinationLock } from '../components/CombinationLock';
import { IdCardModal, type CardKind } from '../components/IdCard';
import type { HotspotDef } from '../components/Hotspot';
import { sfx } from '../audio/engine';
import { ProceedBar } from '../components/ProceedBar';
import { SceneStrip } from '../components/SceneStrip';
import { LabScene } from '../components/RoomScene';
import { StageLayout } from '../components/StageLayout';
import { Toast, type ToastData } from '../components/Toast';
import { Alert, Modal } from '../components/ui';
import { useEscapp } from '../escapp/EscappProvider';
import { useGame } from '../game/GameProvider';

const HOTSPOTS: HotspotDef[] = [
  {
    id: 'computer',
    label: 'Computer',
    description: 'A terminal, still powered, showing the emergency message.',
    x: 67, y: 39, w: 14, h: 17,
  },
  {
    id: 'desk',
    label: 'Desk Drawer',
    description: 'A drawer under the desk, not quite closed.',
    x: 57, y: 59, w: 10, h: 21,
  },
  {
    id: 'cabinet',
    label: 'Storage Cabinet',
    description: 'A steel cabinet with a three-digit keypad lock.',
    x: 42, y: 35, w: 11, h: 41,
  },
  {
    id: 'door',
    label: 'Cooling Room Door',
    description: 'A sealed door with a card reader beside it.',
    x: 87, y: 28, w: 11, h: 52,
  },
];

export const Stage1Lab = ({ onAdvance }: { onAdvance: () => void }) => {
  const { state, dispatch } = useGame();
  const { submitStage, status, verifiedStages } = useEscapp();
  const [view, setView] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  /** A card being examined. The badge carries the cabinet code on its back. */
  const [card, setCard] = useState<CardKind | null>(null);

  const readComputer = state.inspected.includes('computer');
  const hasBadge = state.inventory.includes('badge');
  const hasCard = state.inventory.includes('accessCard');

  const open = (id: string) => {
    sfx('click');
    setView(id);
    dispatch({ type: 'inspect', id });
  };

  // Always name the next action, so stage 1 can never become a hunt.
  const objective = !readComputer
    ? 'Read the computer.'
    : !hasBadge
      ? 'Search the desk drawer.'
      : !hasCard
        ? 'Open the cabinet; the keypad wants three digits.'
        : 'Use the access card on the cooling room door.';

  return (
    <StageLayout
      stage={1}
      objective={objective}
      stats={[{ label: 'DOOR', value: hasCard ? 'OPEN' : 'SEALED', tone: hasCard ? 'ok' : 'bad' }]}
      scene={<LabScene doorOpen={hasCard} cabinetOpen={state.cabinetOpen} />}
      hotspots={HOTSPOTS}
      seen={state.inspected}
      onHotspot={open}
    >
      <SceneStrip>
        {toast && <Toast data={toast} onClose={() => setToast(null)} />}
        <ProceedBar
          verified={verifiedStages.includes(1)}
          ready={hasCard}
          label="Enter the cooling room"
          waitingLabel="You can still take the access card and try the door first."
          onProceed={onAdvance}
        />
      </SceneStrip>

      {/* 1: what happened */}
      {view === 'computer' && (
        <Modal title="Laboratory Terminal" onClose={() => setView(null)}>
          <div className="terminal">
            <p className="t-head">MERIDIAN FACILITY: SUBLEVEL 3</p>
            <p className="t-alert">** LOCKDOWN: COOLING LOOP B FAILED **</p>
            <p>
              DR. ELENA VALE · CHAMBER C-7<br />
              SEALED INSIDE · EMERGENCY AIR ENGAGED
            </p>
            <p className="t-alert">** C-7 CONTROLS DAMAGED **</p>
            <p>Release conditions cannot be evaluated automatically.</p>
            <p className="t-dim">
              RESPONSE TEAM · REACH COOLING CONTROL.<br />
              &gt; _
            </p>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => {
              dispatch({ type: 'discoverDocument', id: 'emergency-broadcast' });
              setView(null);
            }}
          >
            Understood
          </button>
        </Modal>
      )}

      {/* 2; the badge */}
      {view === 'desk' && (
        <Modal title="Desk Drawer" onClose={() => setView(null)}>
          <p style={{ marginTop: 0, fontSize: 13.5, color: 'var(--text-dim)' }}>
            A lanyard, a dead torch, and an employee badge.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={hasBadge}
            onClick={() => {
              dispatch({ type: 'collect', id: 'badge' });
              setView(null);
              // Hand them the card rather than describing it.
              setCard('badge');
            }}
          >
            {hasBadge ? '✓ Badge taken' : '🪪 Take the badge'}
          </button>
        </Modal>
      )}

      {/* 3; the keypad. Opening the cabinet hands over the card directly. */}
      {view === 'cabinet' && (
        <Modal title="Storage Cabinet" onClose={() => setView(null)}>
          {hasCard ? (
            <Alert tone="ok" title="CABINET EMPTY">
              You already have the emergency access card.
            </Alert>
          ) : (
            <CombinationLock
              disabled={status === 'offline' || status === 'unsupported'}
              onSubmit={(code) => submitStage(1, code)}
              onOpened={() => {
                dispatch({ type: 'openCabinet' });
                dispatch({ type: 'collect', id: 'accessCard' });
                setView(null);
                /*
                 * No message here. The shared stage-solved notification
                 * (game/notifications.ts, "CABINET OPEN") already describes the
                 * access card, and it is shown to everyone on the team. Raising
                 * a second confirmation of the same event put two stacked
                 * messages over the strip the proceed control sits on.
                 */
              }}
            />
          )}
        </Modal>
      )}

      {/* 4; the door */}
      {view === 'door' && (
        <Modal title="Cooling Room Door" onClose={() => setView(null)}>
          {hasCard ? (
            <Alert tone="ok" title="DOOR UNSEALED">
              The reader clicks green and the bolts withdraw. Cold air moves through the gap.
            </Alert>
          ) : (
            <>
              <p style={{ marginTop: 0, color: 'var(--text-dim)', fontSize: 13.5 }}>
                The panel reads <span className="mono">SEALED</span>. The card reader beside it is red.
              </p>
              <button
                className="btn"
                style={{ width: '100%' }}
                onClick={() => {
                  setView(null);
                  setToast({
                    tone: 'bad',
                    title: 'ACCESS DENIED',
                    body: 'The reader stays red. It needs an emergency access card.',
                  });
                }}
              >
                Try the reader
              </button>
            </>
          )}
        </Modal>
      )}

      {card && <IdCardModal kind={card} onClose={() => setCard(null)} />}
    </StageLayout>
  );
};
