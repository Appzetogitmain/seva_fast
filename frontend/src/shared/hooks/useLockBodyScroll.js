import { useEffect } from 'react';

/**
 * Prevents background page scroll while a modal/overlay is open.
 * Uses position:fixed on body so mobile touch scroll is also blocked.
 */
export function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return undefined;

<<<<<<< HEAD
    const scrollY = window.scrollY;
    const html = document.documentElement;
    const { style } = document.body;
    const previous = {
      overflow: style.overflow,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      position: style.position,
      top: style.top,
      width: style.width,
      paddingRight: style.paddingRight,
      htmlOverflow: html.style.overflow,
      htmlOverflowX: html.style.overflowX,
      htmlOverflowY: html.style.overflowY,
    };

    const scrollbarWidth = window.innerWidth - html.clientWidth;

    html.style.overflow = 'hidden';
    html.style.overflowX = 'hidden';
    html.style.overflowY = 'hidden';
    style.overflow = 'hidden';
    style.overflowX = 'hidden';
    style.overflowY = 'hidden';
    style.position = 'fixed';
    style.top = `-${scrollY}px`;
    style.width = '100%';
    if (scrollbarWidth > 0) {
      style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      style.overflow = previous.overflow;
      style.overflowX = previous.overflowX;
      style.overflowY = previous.overflowY;
      style.position = previous.position;
      style.top = previous.top;
      style.width = previous.width;
      style.paddingRight = previous.paddingRight;
      html.style.overflow = previous.htmlOverflow;
      html.style.overflowX = previous.htmlOverflowX;
      html.style.overflowY = previous.htmlOverflowY;
      window.scrollTo(0, scrollY);
=======
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
>>>>>>> 5bbbeb2f775cdf138af153ac5f7802ee9d7d5659
    };
  }, [locked]);
}

export function preventBackdropScroll(event) {
  event.preventDefault();
}
