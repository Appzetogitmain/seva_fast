import { useEffect, useRef } from 'react';

/**
 * Tracks active lock owners using a Set of unique token references.
 * Prevents double-increment or stuck state even if hooks mount/unmount in unexpected orders.
 */
const activeLocks = new Set();
let savedScrollY = 0;
let savedPathname = '';

/**
 * Completely resets and unlocks body & HTML scroll.
 * Safe to call at any time (e.g. on route change).
 */
export function forceUnlockBodyScroll() {
  activeLocks.clear();
  if (typeof document === 'undefined') return;

  const bodyStyle = document.body.style;
  const htmlStyle = document.documentElement.style;

  bodyStyle.overflow = '';
  bodyStyle.position = '';
  bodyStyle.top = '';
  bodyStyle.width = '';
  htmlStyle.overflow = '';
  htmlStyle.overscrollBehavior = '';

  document.body.classList.remove('modal-scroll-locked');
  document.documentElement.classList.remove('modal-scroll-locked');

  // Ensure Lenis smooth-scroll resumes and recalculates limits
  const lenis = window.__lenis;
  if (lenis) {
    lenis.start?.();
    lenis.resize?.();
  }
}

/**
 * Prevents background page scroll while a modal/overlay is open.
 * Supports reference counting for stacked/nested modals using unique instance tokens.
 * Also pauses Lenis smooth-scroll so native overflow-y-auto works inside modals.
 */
export function useLockBodyScroll(locked) {
  const lockTokenRef = useRef(null);
  if (!lockTokenRef.current) {
    lockTokenRef.current = Symbol('scroll-lock-token');
  }

  useEffect(() => {
    const token = lockTokenRef.current;

    if (!locked) {
      activeLocks.delete(token);
      if (activeLocks.size === 0) {
        unlock();
      }
      return undefined;
    }

    if (activeLocks.size === 0) {
      lock();
    }

    activeLocks.add(token);

    return () => {
      activeLocks.delete(token);
      if (activeLocks.size === 0) {
        unlock();
      }
    };
  }, [locked]);
}

function lock() {
  if (typeof document === 'undefined') return;

  savedScrollY =
    window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
  savedPathname = typeof window !== 'undefined' ? window.location.pathname : '';

  const bodyStyle = document.body.style;
  const htmlStyle = document.documentElement.style;

  bodyStyle.overflow = 'hidden';
  bodyStyle.position = 'fixed';
  bodyStyle.top = `-${savedScrollY}px`;
  bodyStyle.width = '100%';
  htmlStyle.overflow = 'hidden';
  htmlStyle.overscrollBehavior = 'contain';

  document.body.classList.add('modal-scroll-locked');
  document.documentElement.classList.add('modal-scroll-locked');

  window.__lenis?.stop?.();
}

function unlock() {
  if (typeof document === 'undefined') return;

  const bodyStyle = document.body.style;
  const htmlStyle = document.documentElement.style;

  bodyStyle.overflow = '';
  bodyStyle.position = '';
  bodyStyle.top = '';
  bodyStyle.width = '';
  htmlStyle.overflow = '';
  htmlStyle.overscrollBehavior = '';

  document.body.classList.remove('modal-scroll-locked');
  document.documentElement.classList.remove('modal-scroll-locked');

  // Only restore previous scroll position if we are still on the same page where it was locked
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  if (currentPath === savedPathname) {
    window.scrollTo(0, savedScrollY);
  }

  // Resume Lenis smooth scroll and update its measurements
  const lenis = window.__lenis;
  if (lenis) {
    if (currentPath === savedPathname) {
      lenis.scrollTo?.(savedScrollY, { immediate: true, force: true });
    }
    lenis.start?.();
    lenis.resize?.();
  }
}

export function preventBackdropScroll(event) {
  if (event.target === event.currentTarget) {
    if (event.cancelable) {
      event.preventDefault();
    }
  }
}