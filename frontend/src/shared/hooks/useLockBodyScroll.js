import { useEffect } from 'react';

/**
 * Prevents background page scroll while a modal/overlay is open.
 * Uses position:fixed on body so mobile touch scroll is also blocked.
 */
export function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return undefined;

    const scrollY = window.scrollY;
    const { style } = document.body;
    const previous = {
      overflow: style.overflow,
      position: style.position,
      top: style.top,
      width: style.width,
      paddingRight: style.paddingRight,
      htmlOverflow: document.documentElement.style.overflow,
    };

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.documentElement.style.overflow = 'hidden';
    style.overflow = 'hidden';
    style.position = 'fixed';
    style.top = `-${scrollY}px`;
    style.width = '100%';
    if (scrollbarWidth > 0) {
      style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      style.overflow = previous.overflow;
      style.position = previous.position;
      style.top = previous.top;
      style.width = previous.width;
      style.paddingRight = previous.paddingRight;
      document.documentElement.style.overflow = previous.htmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}

export function preventBackdropScroll(event) {
  event.preventDefault();
}
