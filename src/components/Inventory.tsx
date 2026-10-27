/**
 * The team's inventory and case file. Every document ever discovered stays
 * openable from here, so teams can return to earlier information at any point
 * instead of having to remember it.
 */

import { useState } from 'react';
import { DOCUMENTS, documentById, type GameDocument } from '../game/documents';
import { useGame } from '../game/GameProvider';
import type { ItemId } from '../game/gameState';
import { DocumentModal } from './DocumentView';
import { IdCardModal, type CardKind } from './IdCard';

/**
 * Inventory items. The two facility cards open as actual cards (see IdCard);
 * the rest open as a short evidence note.
 */
const CARD_ITEMS: Partial<Record<ItemId, CardKind>> = {
  badge: 'badge',
  accessCard: 'access',
};

const ITEM_META: Record<ItemId, { glyph: string; label: string; detail: string }> = {
  badge: {
    glyph: '🪪',
    label: 'Employee Badge',
    detail: 'Maintenance technician badge.',
  },
  accessCard: {
    glyph: '🗝',
    label: 'Emergency Access Card',
    detail: 'Red-striped override card.',
  },
  notebook: { glyph: '📓', label: "Vale's Notebook", detail: 'A lab notebook.' },
  calibrationReport: {
    glyph: '📄',
    label: 'Pump B Test Report',
    detail: 'How the pump flow changes with the dial.',
  },
  safetyProtocol: {
    glyph: '📕',
    label: 'Temperature Action Rules',
    detail: 'What to do about the temperature.',
  },
  containmentProtocol: {
    glyph: '📙',
    label: 'Door Opening Rules',
    detail: 'When the chamber door may be opened.',
  },
};

export const Inventory = () => {
  const { state } = useGame();
  const [openItem, setOpenItem] = useState<ItemId | null>(null);
  const [openCard, setOpenCard] = useState<CardKind | null>(null);
  const [openDoc, setOpenDoc] = useState<GameDocument | null>(null);
  const [showFile, setShowFile] = useState(false);

  const found = DOCUMENTS.filter((d) => state.documents.includes(d.id));

  return (
    <>
      <div className="inventory">
        <span className="inventory-label">Inventory</span>
        {state.inventory.length === 0 && (
          <span className="inv-empty">Nothing collected yet</span>
        )}
        {state.inventory.map((id) => (
          <button
            key={id}
            className="inv-slot"
            onClick={() => {
              const card = CARD_ITEMS[id];
              if (card) setOpenCard(card);
              else setOpenItem(id);
            }}
          >
            <span className="glyph" aria-hidden="true">
              {ITEM_META[id].glyph}
            </span>
            {ITEM_META[id].label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <button
          className="inv-slot"
          onClick={() => setShowFile(true)}
          aria-label={`Case file: ${found.length} documents recovered`}
        >
          <span className="glyph" aria-hidden="true">
            🗂
          </span>
          Case File ({found.length})
        </button>
      </div>

      {openCard && <IdCardModal kind={openCard} onClose={() => setOpenCard(null)} />}

      {openItem && (
        <DocumentModal
          onClose={() => setOpenItem(null)}
          doc={{
            id: openItem,
            title: ITEM_META[openItem].label,
            kind: 'memo',
            source: 'EVIDENCE: EMERGENCY RESPONSE TEAM',
            stage: 0,
            body: [ITEM_META[openItem].detail],
          }}
        />
      )}

      {openDoc && <DocumentModal doc={openDoc} onClose={() => setOpenDoc(null)} />}

      {showFile && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setShowFile(false)}
        >
          <div className="modal panel" role="dialog" aria-modal="true" aria-label="Case file">
            <div className="panel-head">
              <h3>Case File: Recovered Documents</h3>
              <button
                className="modal-close"
                onClick={() => setShowFile(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="panel-body">
              {found.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--text-dim)' }}>
                  No documents recovered yet. Search the laboratory.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: 9 }}>
                  {found.map((d) => (
                    <button
                      key={d.id}
                      className="interlock-row"
                      style={{ textAlign: 'left', width: '100%' }}
                      onClick={() => {
                        setShowFile(false);
                        setOpenDoc(documentById(d.id) ?? null);
                      }}
                    >
                      <span aria-hidden="true" style={{ fontSize: 18 }}>
                        📄
                      </span>
                      <span className="interlock-text">
                        <b>{d.title}</b>
                        <span>{d.source}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
