/**
 * Renders a recovered document as a sheet of paper. Paragraphs prefixed with
 * "> " become monospaced callouts, that is where specification values and
 * formulae live, so they read as printed engineering data rather than as the
 * game telling the player an answer.
 */

import type { GameDocument } from '../game/documents';
import { Modal } from './ui';

const KIND_LABEL: Record<GameDocument['kind'], string> = {
  memo: 'Memorandum',
  report: 'Technical Report',
  protocol: 'Safety Protocol',
  log: 'Logbook Entry',
};

export const DocumentSheet = ({ doc }: { doc: GameDocument }) => (
  <article className="doc">
    <div className="doc-letterhead">
      <span>{doc.source}</span>
      <span>{KIND_LABEL[doc.kind]}</span>
    </div>
    <h2>{doc.title}</h2>
    {doc.body.map((para, i) =>
      para.startsWith('> ') ? (
        <p key={i} className="doc-callout">
          {para.slice(2)}
        </p>
      ) : (
        <p key={i}>{para}</p>
      ),
    )}
  </article>
);

export const DocumentModal = ({ doc, onClose }: { doc: GameDocument; onClose: () => void }) => (
  <Modal title={doc.title} onClose={onClose} bare>
    <DocumentSheet doc={doc} />
  </Modal>
);
