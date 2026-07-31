import React from 'react';
import { useAuth } from '@core/context/AuthContext';
import {
    HiOutlineLogout,
    HiOutlineUserCircle,
    HiOutlineBell,
    HiOutlineSearch,
    HiOutlineMenu,
    HiOutlineArrowLeft
} from 'react-icons/hi';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { sellerApi } from '@/modules/seller/services/sellerApi';
import { adminApi } from '@/modules/admin/services/adminApi';
import { AnimatePresence } from 'framer-motion';
import NotificationPopup from './NotificationPopup';
import { toast } from 'sonner';

import { useSettings } from '@core/context/SettingsContext';
import { useSignOutConfirmation } from '@shared/hooks/useSignOutConfirmation';

const Topbar = ({ onMenuClick }) => {
    const { user, role } = useAuth();
    const { requestSignOut, signOutDialog } = useSignOutConfirmation();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const location = useLocation();

    const appName = settings?.appName || 'App';
    const logoUrl = settings?.logoUrl || '';

    const [searchQuery, setSearchQuery] = React.useState('');
    const [notifications, setNotifications] = React.useState([]);
    const [unreadCount, setUnreadCount] = React.useState(0);
    const [showNotifications, setShowNotifications] = React.useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = React.useState(false);
    const notificationRef = React.useRef(null);
    const isFetchingNotificationsRef = React.useRef(false);

    const isSeller = location.pathname.startsWith('/seller');
    const isAdmin = location.pathname.startsWith('/admin');

    const handleSearchSubmit = (e) => {
        e?.preventDefault();
        const q = (searchQuery || '').trim();
        if (!q) return;
        if (isSeller) {
            navigate(`/seller/products?q=${encodeURIComponent(q)}`);
            return;
        }
        if (isAdmin) {
            navigate(`/admin/orders/all?search=${encodeURIComponent(q)}`);
        }
    };

    const fetchNotifications = async () => {
        try {
            if (!isSeller && !isAdmin) return;
            if (isFetchingNotificationsRef.current) return;
            isFetchingNotificationsRef.current = true;
            const response = isSeller
                ? await sellerApi.getNotifications()
                : await adminApi.getNotifications();
            if (response.data.success) {
                const payload = response.data.result || {};
                const items = payload.notifications || payload.items || [];
                setNotifications(items);
                setUnreadCount(Number(payload.unreadCount || 0));
            }
        } catch (error) {
            const status = error?.response?.status;
            if (status === 503) return;
            console.error("Notif Fetch Error:", error);
        } finally {
            isFetchingNotificationsRef.current = false;
        }
    };

    React.useEffect(() => {
        fetchNotifications();
        if (!isSeller && !isAdmin) return undefined;
        const poll = setInterval(fetchNotifications, 20000);
        return () => clearInterval(poll);
    }, [isSeller, isAdmin]);

    // Handle Click Outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAsRead = async (id) => {
        try {
            if (!id) return;
            if (isSeller) await sellerApi.markNotificationRead(id);
            if (isAdmin) await adminApi.markNotificationRead(id);
            fetchNotifications();
        } catch (error) {
            toast.error("Failed to mark as read");
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            if (isSeller) await sellerApi.markAllNotificationsRead();
            if (isAdmin) await adminApi.markAllNotificationsRead();
            fetchNotifications();
            toast.success("All caught up!");
        } catch (error) {
            toast.error("Failed to mark all as read");
        }
    };

    const handleOpenNotification = (notif) => {
        const raw = String(notif?.data?.link || notif?.link || "").trim();
        let path = "";
        if (raw) {
            try {
                if (/^https?:\/\//i.test(raw)) {
                    const url = new URL(raw);
                    path = `${url.pathname}${url.search}${url.hash}` || "";
                } else {
                    path = raw.startsWith("/") ? raw : `/${raw}`;
                }
            } catch {
                path = "";
            }
        }

        // Fallback by event type when link missing / old localhost-only payloads
        if (!path || path === "/") {
            const type = String(notif?.type || notif?.data?.eventType || "").toUpperCase();
            const orderId = notif?.data?.orderId || "";
            if (isAdmin && (type.includes("RETURN") || type === "RETURN_REQUESTED" || type === "RETURN_COMPLETED")) {
                path = orderId
                    ? `/admin/returns?orderId=${encodeURIComponent(orderId)}`
                    : "/admin/returns";
            } else if (isAdmin && type.includes("SELLER")) {
                path = "/admin/pending-sellers";
            } else if (isSeller && type.includes("RETURN")) {
                path = orderId
                    ? `/seller/returns?orderId=${encodeURIComponent(orderId)}`
                    : "/seller/returns";
            }
        }

        setShowNotifications(false);
        if (path && path !== "/") {
            navigate(path);
        }
    };

    const handleLogout = () => {
        requestSignOut();
    };

    if (isMobileSearchOpen) {
        return (
            <header className={cn(
                "bg-white/70 backdrop-blur-xl border-b border-gray-100/50 flex items-center px-4 h-14 shadow-[0_4px_30px_rgba(0,0,0,0.02)] transition-all duration-300",
                (role === 'admin' || role === 'seller')
                    ? "fixed top-0 left-0 right-0 z-[200] md:hidden"
                    : "fixed top-0 left-0 right-0 z-40 md:hidden"
            )}>
                <button
                    onClick={() => setIsMobileSearchOpen(false)}
                    className="p-2 mr-3 bg-gray-100/80 hover:bg-gray-200 rounded-xl text-gray-600 transition-all shadow-sm flex-shrink-0"
                >
                    <HiOutlineArrowLeft className="h-5 w-5" />
                </button>
                <form onSubmit={(e) => { handleSearchSubmit(e); setIsMobileSearchOpen(false); }} className="relative flex-1 group">
                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 focus-within:text-primary transition-all duration-300" />
                    <input
                        type="text"
                        autoFocus
                        placeholder={isSeller ? "Search products..." : "Search anything..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-gray-100/50 border border-transparent rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/20 outline-none"
                    />
                </form>
            </header>
        );
    }

    return (
        <>
        <header className={cn(
            "bg-white/70 backdrop-blur-xl border-b border-gray-100/50 flex items-center justify-between shadow-[0_4px_30px_rgba(0,0,0,0.02)] transition-all duration-300",
            (role === 'admin' || role === 'seller')
                ? "fixed top-0 left-0 right-0 z-[200] h-14 px-4 md:sticky md:top-0 md:h-16 md:px-6"
                : "fixed top-0 left-72 right-0 h-16 px-6 z-40"
        )}>
            <div className="flex items-center flex-1 mr-4 overflow-hidden">
                <button
                    onClick={onMenuClick}
                    className="p-2.5 mr-3 bg-gray-100/80 hover:bg-white rounded-xl text-gray-600 hover:text-primary transition-all duration-300 md:hidden border border-transparent hover:border-primary/20 shadow-sm"
                >
                    <HiOutlineMenu className="h-5 w-5" />
                </button>

                {/* Mobile Logo */}
                <div className="flex items-center space-x-2 mr-4 md:hidden">
                    {logoUrl ? (
                        <div className="h-8 w-8 rounded-lg overflow-hidden shadow-md shadow-primary/10 border border-gray-100">
                            <img src={logoUrl} alt={appName} className="h-full w-full object-contain" />
                        </div>
                    ) : (
                        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white font-black text-sm shadow-md">
                            {appName.charAt(0)}
                        </div>
                    )}
                </div>

                {/* Mobile Search Button */}
                <button
                    onClick={() => setIsMobileSearchOpen(true)}
                    className="p-2 bg-gray-100/50 rounded-xl text-gray-500 hover:text-primary md:hidden ml-auto mr-2"
                >
                    <HiOutlineSearch className="h-5 w-5" />
                </button>

                {/* Desktop Search Input */}
                <form onSubmit={handleSearchSubmit} className="relative hidden md:flex flex-1 md:w-[400px] group">
                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-all duration-300" />
                    <input
                        type="text"
                        placeholder={isSeller ? "Search products..." : "Search anything..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                        className="w-full pl-9 pr-3 py-2 bg-gray-100/50 border border-transparent rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/20 transition-all duration-500 outline-none"
                    />
                </form>
            </div>

            <div className="flex items-center space-x-4">
                <div className="relative" ref={notificationRef}>
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={cn(
                            "p-2 hover:bg-primary/5 text-gray-500 hover:text-primary rounded-xl transition-all duration-300 relative group",
                            showNotifications && "bg-primary/5 text-primary"
                        )}
                    >
                        <HiOutlineBell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 h-2 w-2 bg-rose-500 rounded-full ring-2 ring-white shadow-sm"></span>
                        )}
                    </button>

                    <AnimatePresence>
                        {showNotifications && (
                            <NotificationPopup
                                notifications={notifications}
                                onMarkAsRead={handleMarkAsRead}
                                onMarkAllAsRead={handleMarkAllAsRead}
                                onOpenNotification={handleOpenNotification}
                                onClose={() => setShowNotifications(false)}
                            />
                        )}
                    </AnimatePresence>
                </div>

                <div className="h-8 w-px bg-gray-100 mx-1"></div>
                <button
                    onClick={() => {
                        if (location.pathname.startsWith('/admin')) {
                            navigate('/admin/profile');
                        } else if (location.pathname.startsWith('/seller')) {
                            navigate('/seller/profile');
                        } else if (location.pathname.startsWith('/delivery')) {
                            navigate('/delivery/profile');
                        } else {
                            navigate('/profile');
                        }
                    }}
                    className="flex items-center space-x-2.5 p-1 pr-3 hover:bg-gray-50 rounded-xl transition-all duration-300 group ring-1 ring-transparent hover:ring-gray-100 shadow-sm hover:shadow-md"
                >
                    <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform overflow-hidden border border-gray-100">
                        {logoUrl ? (
                            <img src={logoUrl} alt="SevaFast Logo" className="h-full w-full object-contain p-1" />
                        ) : (
                            <div className="h-full w-full bg-primary flex items-center justify-center text-white font-bold text-xs">
                                {user?.name?.[0] || 'A'}
                            </div>
                        )}
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-900 leading-tight">{user?.name || 'Demo User'}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{user?.role || 'Member'}</p>
                    </div>
                </button>
                <button
                    onClick={handleLogout}
                    className="flex items-center space-x-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-300 font-bold text-xs shadow-sm hover:shadow-rose-100/50"
                >
                    <HiOutlineLogout className="h-4 w-4" />
                    <span className="hidden lg:block">Sign Out</span>
                </button>
            </div>
        </header>
        {signOutDialog}
        </>
    );
};

export default Topbar;

