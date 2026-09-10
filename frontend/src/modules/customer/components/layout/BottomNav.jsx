import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, User, Sparkles, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
    { label: 'Home', icon: Home, path: '/' },
    { label: 'Category', icon: LayoutGrid, path: '/categories' },
    { label: 'Services', icon: Wrench, path: '/professionals' },
    { label: 'Plans', icon: Sparkles, path: '/plans' },
    { label: 'Profile', icon: User, path: '/profile' },
];

const BottomNav = () => {
    const location = useLocation();
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
        <div className="fixed bottom-0 left-0 right-0 z-[500] bg-white border-t border-gray-100 flex items-center justify-around h-[70px] md:hidden shadow-[0_-8px_30px_rgba(0,0,0,0.06)] px-4 pb-[env(safe-area-inset-bottom)]">
            {navItems.map((item) => {
                const isActive = location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path));

                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className="flex-1 flex flex-col items-center justify-center h-full relative group transition-all"
                    >
                        {isActive && (
                            <div className="absolute -inset-y-2 -inset-x-4 bg-primary/5 rounded-[20px] -z-10 transition-opacity duration-300" />
                        )}

                        <div className="flex flex-col items-center justify-center relative">
                            <div
                                className={cn(
                                    "transition-transform duration-300",
                                    isActive ? "-translate-y-0.5 scale-110" : "translate-y-0 scale-100"
                                )}
                            >
                                <item.icon
                                    size={24}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    className={cn(
                                        "transition-colors duration-300",
                                        isActive ? "text-primary" : "text-gray-400"
                                    )}
                                />
                            </div>

                            <span
                                className={cn(
                                    "text-[10px] font-bold tracking-tight mt-1 transition-all duration-300",
                                    isActive ? "text-primary" : "text-gray-400"
                                )}
                                style={{ transform: isActive ? "translateY(1px)" : "translateY(0)" }}
                            >
                                {item.label}
                            </span>
                        </div>

                        {/* Top Accent Line for Active State */}
                        {isActive && (
                            <div className="absolute -top-[1px] w-8 h-[3px] bg-primary rounded-full transition-opacity duration-300" />
                        )}
                    </Link>
                );
            })}
        </div>
    );
};

export default BottomNav;

