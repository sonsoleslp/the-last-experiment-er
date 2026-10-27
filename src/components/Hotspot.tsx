/**
 * A clickable object in the room.
 *
 * Positioned over the room SVG in percentage coordinates but rendered as a
 * real <button>, so everything in the environment is reachable by keyboard and
 * announced to screen readers with a meaningful name. `description` is the
 * text alternative for the visual clue.
 */

export interface HotspotDef {
  id: string;
  label: string;
  /** Text alternative: what a sighted player learns by looking at it. */
  description: string;
  /** Percentage box over the room image. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export const Hotspot = ({
  def,
  seen,
  onActivate,
  disabled,
}: {
  def: HotspotDef;
  seen: boolean;
  onActivate: () => void;
  disabled?: boolean;
}) => (
  <button
    className="hotspot"
    data-seen={seen}
    disabled={disabled}
    onClick={onActivate}
    aria-label={`${def.label}. ${def.description}${seen ? ' Already examined.' : ''}`}
    style={{ left: `${def.x}%`, top: `${def.y}%`, width: `${def.w}%`, height: `${def.h}%` }}
  >
    <span className="hotspot-label">{def.label}</span>
    {!seen && <span className="hotspot-pip" aria-hidden="true" />}
  </button>
);
