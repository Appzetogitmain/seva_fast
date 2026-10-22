import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, User, Sparkles, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const navItems = [
    { labelKey: 'nav.home', icon: Home, path: '/' },
    { labelKey: 'nav.category', icon: LayoutGrid, path: '/categories' },
    { labelKey: 'nav.services', icon: Wrench, path: '/professionals' },
    { labelKey: 'nav.plans', icon: Sparkles, path: '/plans' },
    { labelKey: 'nav.profile', icon: User, path: '/profile' },
];

const BottomNav = () => {
    const location = useLocation();
    const { t } = useTranslation('customer');
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleFocusIn = (e) => {
            const tag = e.target?.tagName?.toUpperCase();
            if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) {
                setIsKeyboardOpen(true);
            }
        };

        const handleFocusOut = (e) => {
            const tag = e.target?.tagName?.toUpperCase();
            if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) {
                setIsKeyboardOpen(false);
            }
        };

        const handleViewportResize = () => {
            if (window.visualViewport) {
                // If the visual viewport height shrinks significantly, mobile keyboard is open
                const isShrunk = window.visualViewport.height < window.innerHeight * 0.75;
                setIsKeyboardOpen(isShrunk);
            }
        };

        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('focusout', handleFocusOut);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleViewportResize);
        }

        return () => {
            document.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('focusout', handleFocusOut);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleViewportResize);
            }
        };
    }, []);

    if (isKeyboardOpen) {
        return null;
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[500] bg-white/95 backdrop-blur-md border-t border-gray-100 flex items-center justify-around h-[68px] md:hidden shadow-[0_-8px_30px_rgba(0,0,0,0.06)] px-2 pb-[env(safe-area-inset-bottom)] overflow-hidden">
            {navItems.map((item) => {
                const isActive = location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path));

                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className="flex-1 flex flex-col items-center justify-center h-full relative py-1 transition-all select-none"
                    >
                        {/* Top Accent Line on Active State */}
                        {isActive && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-primary rounded-b-full shadow-sm shadow-primary/30 transition-all duration-300" />
                        )}

                        {/* Contained Active Background Pill */}
                        {isActive && (
                            <div className="absolute inset-x-1 inset-y-1.5 bg-primary/8 rounded-2xl -z-10 transition-all duration-300" />
                        )}

                        <div className="flex flex-col items-center justify-center relative">
                            <div
                                className={cn(
                                    "transition-transform duration-300",
                                    isActive ? "-translate-y-0.5 scale-105" : "translate-y-0 scale-100"
                                )}
                            >
                                <item.icon
                                    size={22}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    className={cn(
                                        "transition-colors duration-300",
                                        isActive ? "text-primary" : "text-gray-400"
                                    )}
                                />
                            </div>

                            <span
                                className={cn(
                                    "text-[10px] tracking-tight mt-1 transition-colors duration-300",
                                    isActive ? "text-primary font-black" : "text-gray-400 font-medium"
                                )}
                            >
                                {t(item.labelKey)}
                            </span>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
};

export default BottomNav;

