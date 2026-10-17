import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { forceUnlockBodyScroll } from "@shared/hooks/useLockBodyScroll";

const ScrollToTop = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        // Guarantee that navigating to any route clears any stuck modal scroll locks
        forceUnlockBodyScroll();

        // Native scroll reset
        window.scrollTo(0, 0);

        // Synchronize and refresh Lenis smooth-scroll
        const lenis = window.__lenis;
        if (lenis) {
            lenis.scrollTo?.(0, { immediate: true, force: true });
            lenis.start?.();
            lenis.resize?.();

            const rId = requestAnimationFrame(() => {
                window.__lenis?.resize?.();
            });
            const t1 = setTimeout(() => {
                window.__lenis?.resize?.();
            }, 100);
            const t2 = setTimeout(() => {
                window.__lenis?.resize?.();
            }, 400);

            return () => {
                cancelAnimationFrame(rId);
                clearTimeout(t1);
                clearTimeout(t2);
            };
        }
    }, [pathname]);

    return null;
};

export default ScrollToTop;
