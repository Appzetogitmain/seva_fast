import { useEffect } from 'react';

/**
 * Prevents background page scroll while a modal/overlay is open.
 * Also pauses Lenis smooth-scroll so native overflow-y-auto works inside modals.
 */
export function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return undefined;

    const scrollY = window.scrollY;
    const { style } = document.body;
    const htmlStyle = document.documentElement.style;

    const prevBodyOverflow = style.overflow;
    const prevBodyPos = style.position;
    const prevBodyTop = style.top;
    const prevBodyWidth = style.width;
    const prevHtmlOverflow = htmlStyle.overflow;

    style.overflow = 'hidden';
    style.position = 'fixed';
    style.top = `-${scrollY}px`;
    style.width = '100%';
    htmlStyle.overflow = 'hidden';

    // Stop Lenis so it doesn't hijack wheel events inside the modal
    window.__lenis?.stop();

    return () => {
      style.overflow = prevBodyOverflow;
      style.position = prevBodyPos;
      style.top = prevBodyTop;
      style.width = prevBodyWidth;
      htmlStyle.overflow = prevHtmlOverflow;
      window.scrollTo(0, scrollY);

      // Resume Lenis smooth scrolling
      window.__lenis?.start();
    };
  }, [locked]);
}

export function preventBackdropScroll(event) {
  if (event.target === event.currentTarget) {
    event.preventDefault();
  }
}

