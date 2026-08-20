import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell, CheckCheck, Package, Truck, CheckCircle2,
    XCircle, CreditCard, Wallet, Megaphone, Sparkles,
    X, RefreshCw, Loader2, ArrowRight, Clock
} from 'lucide-react';
import { customerApi } from '../../services/customerApi';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

function getNotificationIcon(notif) {
    const event = String(notif.event || notif.type || '').toLowerCase();
    const title = String(notif.title || '').toLowerCase();

    if (event.includes('deliver') && (event.includes('out') || title.includes('out for delivery'))) {
        return { icon: Truck, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
    }
    if (event.includes('deliver') && (event.includes('success') || event.includes('delivered') || title.includes('delivered'))) {
        return { icon: CheckCircle2, color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
    }
    if (event.includes('cancel') || title.includes('cancelled')) {
        return { icon: XCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
    }
    if (event.includes('order') || title.includes('order')) {
        return { icon: Package, color: '#6366f1', bg: 'rgba(99,102,241,0.12)' };
    }
    if (event.includes('refund') || event.includes('wallet') || event.includes('payment') || title.includes('refund') || title.includes('wallet')) {
        return { icon: Wallet, color: '#059669', bg: 'rgba(5,150,105,0.12)' };
    }
    if (event.includes('broadcast') || event.includes('promo') || title.includes('offer') || title.includes('sale')) {
        return { icon: Megaphone, color: '#a855f7', bg: 'rgba(168,85,247,0.12)' };
    }
    return { icon: Bell, color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' };
}

function formatTimeAgo(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHrs = Math.floor(diffMin / 60);
        const diffDays = Math.floor(diffHrs / 24);

        if (diffSec < 45) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHrs < 24) return `${diffHrs}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    } catch {
        return '';
    }
}

function resolveNotificationTarget(notif) {
    if (!notif) return null;

    // 1. Direct link in data or root
    const rawLink = notif.data?.link || notif.link || notif.url || notif.data?.url;
    if (rawLink && typeof rawLink === 'string') {
        const trimmed = rawLink.trim();
        if (trimmed.startsWith('/')) {
            return trimmed;
        }
        try {
            const urlObj = new URL(trimmed, window.location.origin);
            if (urlObj.origin === window.location.origin) {
                return urlObj.pathname + urlObj.search;
            }
        } catch {}
    }

    // 2. Order ID (navigate to /orders/:id which is the customer OrderDetailPage)
    const rawOrderId = notif.data?.orderId || notif.orderId || notif.metadata?.orderId || notif.data?.order?._id || notif.data?.order?.id;
    if (rawOrderId) {
        return `/orders/${encodeURIComponent(String(rawOrderId).trim())}`;
    }

    // 3. Check for order ID in title or message text (e.g. Order #65df... or Order #1234)
    const combinedText = `${notif.title || ''} ${notif.message || notif.body || ''}`;
    const orderMatch = combinedText.match(/#([a-fA-F0-9]{24})/i) || combinedText.match(/#([a-zA-Z0-9_-]{4,})/);
    if (orderMatch && orderMatch[1]) {
        return `/orders/${encodeURIComponent(orderMatch[1])}`;
    }

    // 4. Infer by event or type
    const event = String(notif.event || notif.type || '').toLowerCase();
    const title = String(notif.title || '').toLowerCase();

    if (event.includes('order') || event.includes('deliver') || title.includes('order') || title.includes('deliver')) {
        return '/orders';
    }
    if (event.includes('wallet') || event.includes('refund') || title.includes('wallet') || title.includes('refund') || title.includes('payment')) {
        return '/wallet';
    }
    if (event.includes('plan') || event.includes('subscription') || title.includes('plan')) {
        return '/plans';
    }
    if (event.includes('support') || event.includes('ticket') || event.includes('chat')) {
        return '/chat';
    }
    if (event.includes('offer') || event.includes('promo') || title.includes('offer') || title.includes('sale')) {
        return '/offers';
    }

    return '/orders';
}

export const CustomerNotificationsModal = ({ isOpen, onClose, onUnreadCountChange }) => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isMarkingAll, setIsMarkingAll] = useState(false);
    const [filter, setFilter] = useState('all'); // 'all' | 'unread'

    const fetchNotifications = async () => {
        try {
            setIsLoading(true);
            const res = await customerApi.getNotifications();
            const raw = res.data?.result || res.data?.results || res.data?.data || res.data || [];
            const list = Array.isArray(raw) ? raw : (raw.items || []);
            setNotifications(list);
            
            const unread = list.filter(n => !n.isRead && !n.read).length;
            if (onUnreadCountChange) onUnreadCountChange(unread);
        } catch (err) {
            console.error("Failed to fetch customer notifications", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen]);

    const handleMarkAllRead = async () => {
        try {
            setIsMarkingAll(true);
            await customerApi.markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true, read: true })));
            if (onUnreadCountChange) onUnreadCountChange(0);
            toast.success("All notifications marked as read");
        } catch (err) {
            toast.error("Could not mark notifications as read");
        } finally {
            setIsMarkingAll(false);
        }
    };

    const handleItemClick = async (notif) => {
        // Mark individual item as read if unread
        if (!notif.isRead && !notif.read) {
            try {
                await customerApi.markNotificationRead(notif._id || notif.id);
                setNotifications(prev => prev.map(n => (n._id === notif._id ? { ...n, isRead: true, read: true } : n)));
                const remainingUnread = notifications.filter(n => (n._id !== notif._id) && !n.isRead && !n.read).length;
                if (onUnreadCountChange) onUnreadCountChange(remainingUnread);
            } catch (e) {
                // Best effort
            }
        }

        onClose();

        const targetPath = resolveNotificationTarget(notif);
        if (targetPath) {
            navigate(targetPath);
        }
    };

    if (!isOpen) return null;

    const unreadCount = notifications.filter(n => !n.isRead && !n.read).length;
    const filteredNotifications = filter === 'unread' 
        ? notifications.filter(n => !n.isRead && !n.read) 
        : notifications;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
            <div className="bg-slate-50 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl h-[85vh] max-h-[680px] relative animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-slate-200/80 bg-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
                            <Bell size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900 text-base leading-none">Notifications</h3>
                                {unreadCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white">
                                        {unreadCount} New
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Stay updated on your orders & offers</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                disabled={isMarkingAll}
                                className="px-2.5 py-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Mark all as read"
                            >
                                <CheckCheck size={14} />
                                <span className="hidden sm:inline">Mark all read</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Filter Pills */}
                {notifications.length > 0 && (
                    <div className="px-4 py-2 bg-white/60 border-b border-slate-200/50 flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setFilter('all')}
                            className={cn(
                                "px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer",
                                filter === 'all'
                                    ? "bg-slate-900 text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            All ({notifications.length})
                        </button>
                        <button
                            onClick={() => setFilter('unread')}
                            className={cn(
                                "px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer",
                                filter === 'unread'
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            Unread ({unreadCount})
                        </button>
                        <button
                            onClick={fetchNotifications}
                            disabled={isLoading}
                            className="ml-auto p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Refresh"
                        >
                            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                        </button>
                    </div>
                )}

                {/* Notification List */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
                    {isLoading && notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-3">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                            <p className="text-xs font-semibold text-slate-500">Loading notifications...</p>
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-72 text-center px-4 space-y-3">
                            <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-400">
                                <Bell size={28} />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-800">
                                    {filter === 'unread' ? "No Unread Notifications" : "No Notifications Yet"}
                                </h4>
                                <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
                                    {filter === 'unread' 
                                        ? "You've read all your updates! Check the 'All' tab to review previous notifications."
                                        : "You're all caught up! Order milestones, alerts, and special offers will show up here."
                                    }
                                </p>
                            </div>
                        </div>
                    ) : (
                        filteredNotifications.map((notif) => {
                            const isUnread = !notif.isRead && !notif.read;
                            const { icon: IconComp, color, bg } = getNotificationIcon(notif);
                            const hasLink = notif.data?.orderId || notif.orderId || notif.data?.link || notif.link;

                            return (
                                <div
                                    key={notif._id || notif.id}
                                    onClick={() => handleItemClick(notif)}
                                    className={cn(
                                        "p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 relative group select-none",
                                        isUnread
                                            ? "bg-white border-indigo-200/80 shadow-xs hover:border-indigo-300"
                                            : "bg-white/80 border-slate-200/60 hover:bg-white hover:border-slate-300"
                                    )}
                                >
                                    {/* Icon */}
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                                        style={{ backgroundColor: bg }}
                                    >
                                        <IconComp size={18} style={{ color }} />
                                    </div>

                                    {/* Body */}
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <h4 className={cn(
                                                "text-xs font-bold text-slate-900 truncate",
                                                isUnread && "font-black text-indigo-950"
                                            )}>
                                                {notif.title || "Notification"}
                                            </h4>
                                            <span className="text-[10px] font-medium text-slate-400 shrink-0 flex items-center gap-1">
                                                <Clock size={10} />
                                                {formatTimeAgo(notif.createdAt || notif.date)}
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                                            {notif.message || notif.body || notif.description || ""}
                                        </p>

                                        {hasLink && (
                                            <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-indigo-600 group-hover:text-indigo-800 transition-colors">
                                                <span>View details</span>
                                                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Unread indicator dot */}
                                    {isUnread && (
                                        <span className="absolute top-4 right-3.5 w-2 h-2 rounded-full bg-indigo-600 ring-4 ring-indigo-50" />
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
export default CustomerNotificationsModal;
