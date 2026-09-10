import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    ClipboardList,
    Box,
    Wallet,
    MoreHorizontal,
    ChevronDown,
    X
} from 'lucide-react';

import { useAuth } from '@core/context/AuthContext';

const BottomNav = ({ navItems }) => {
    const { role } = useAuth();
    const location = useLocation();
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

    useEffect(() => {
        // Fallback for older browsers
        const handleFocusIn = (e) => {
            const tagName = e.target?.tagName?.toLowerCase();
            if (['input', 'textarea', 'select'].includes(tagName)) {
                const type = e.target?.type?.toLowerCase();
                if (type !== 'radio' && type !== 'checkbox') {
                    setIsKeyboardOpen(true);
                }
            }
        };
        const handleFocusOut = () => {
            setIsKeyboardOpen(false);
        };

        if (window.visualViewport) {
            const initialHeight = window.visualViewport.height;
            const handleResize = () => {
                // If viewport shrinks by > 150px, assume virtual keyboard is open
                if (initialHeight - window.visualViewport.height > 150) {
                    setIsKeyboardOpen(true);
                } else {
                    setIsKeyboardOpen(false);
                }
            };
            window.visualViewport.addEventListener('resize', handleResize);
            return () => window.visualViewport.removeEventListener('resize', handleResize);
        } else {
            document.addEventListener('focusin', handleFocusIn);
            document.addEventListener('focusout', handleFocusOut);
            return () => {
                document.removeEventListener('focusin', handleFocusIn);
                document.removeEventListener('focusout', handleFocusOut);
            };
        }
    }, []);

    // Define the primary bottom nav items based on user role
    const primaryItems = role === 'admin' ? [
        { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, end: true },
        { label: 'Orders', path: '/admin/orders/all', icon: ClipboardList },
        { label: 'Products', path: '/admin/products', icon: Box },
        { label: 'Wallet', path: '/admin/wallet', icon: Wallet },
    ] : [
        { label: 'Dashboard', path: '/seller', icon: LayoutDashboard, end: true },
        { label: 'Orders', path: '/seller/orders', icon: ClipboardList },
        { label: 'Products', path: '/seller/products', icon: Box },
        { label: 'Earnings', path: '/seller/earnings', icon: Wallet },
    ];

    if (isKeyboardOpen) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-xl border-t border-gray-100 z-[60] md:hidden px-2 flex items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
            {primaryItems.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    className={({ isActive }) => cn(
                        "flex flex-col items-center justify-center space-y-1 w-16 transition-all duration-300",
                        isActive ? "text-primary" : "text-gray-400 hover:text-gray-600"
                    )}
                >
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">{item.label}</span>
                </NavLink>
            ))}
        </div>
    );
};

export default BottomNav;

