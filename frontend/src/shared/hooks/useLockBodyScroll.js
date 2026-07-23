import { useEffect } from 'react';

/**
 * Prevents background page scroll while a modal/overlay is open.
 * Uses position:fixed on body so mobile touch scroll is also blocked.
 */
export function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [locked]);
}

export function preventBackdropScroll(event) {
  event.preventDefault();
}
