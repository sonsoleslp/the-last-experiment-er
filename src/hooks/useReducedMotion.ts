/**
 * Whether the viewer has asked for reduced motion.
 *
 * The CSS rule in index.css collapses CSS animations and transitions, but SVG
 * SMIL animation (`<animate>`, `<animateTransform>`) is not affected by
 * `prefers-reduced-motion` at all. The intro is almost entirely SMIL, so the
 * preference has to be read in JavaScript and the animation elements simply
 * not rendered.
 */

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(() => {
    try {
      return window.matchMedia(QUERY).matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(QUERY);
    } catch {
      return;
    }
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    // Safari below 14 only has the deprecated listener API.
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  return reduced;
};
