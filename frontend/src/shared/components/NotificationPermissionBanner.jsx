import React, { useEffect, useState } from 'react';
import { BellRing, X, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
    describePushSupport,
    ensureFcmTokenRegistered,
    startForegroundPushListener,
    hasRegisteredFcmToken,
} from '@core/firebase/pushClient';

const DISMISS_KEY_PREFIX = 'push:banner-dismissed:';

/**
 * Visible prompt to enable browser notification permission, shown on the seller/rider
 * layouts. Without OS-level permission, order alerts only fire while the tab is
 * focused (in-page socket + <audio>), so this is the only way to get sound/alerts
 * when the app is minimized or another app is in the foreground.
 */
const NotificationPermissionBanner = ({ role }) => {
    const [permission, setPermission] = useState('unsupported');
    const [dismissed, setDismissed] = useState(false);
    const [isEnabling, setIsEnabling] = useState(false);

    const dismissKey = `${DISMISS_KEY_PREFIX}${role}`;

    useEffect(() => {
        const support = describePushSupport();
        if (!support.supported) {
            setPermission('unsupported');
            return;
        }
        if (typeof Notification === 'undefined') {
            setPermission('unsupported');
            return;
        }
        setPermission(Notification.permission);
        setDismissed(sessionStorage.getItem(dismissKey) === '1');
    }, [dismissKey]);

    if (permission === 'unsupported' || permission === 'granted' || dismissed) {
        return null;
    }

    if (permission === 'default' && hasRegisteredFcmToken(role)) {
        return null;
    }

    const handleDismiss = () => {
        sessionStorage.setItem(dismissKey, '1');
        setDismissed(true);
    };

    const handleEnable = async () => {
        if (isEnabling) return;
        setIsEnabling(true);
        try {
            await ensureFcmTokenRegistered({ role, platform: 'web' });
            await startForegroundPushListener();
            setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'granted');
            toast.success('Order alerts enabled — you\'ll now get a sound + notification even if this tab is minimized.');
        } catch (error) {
            setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
            toast.error(error?.message || 'Could not enable order alerts');
        } finally {
            setIsEnabling(false);
        }
    };

    if (permission === 'denied') {
        return (
            <div className="mx-4 md:mx-0 mt-3 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm">
                <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 text-red-800">
                    <p className="font-medium">Order alerts are blocked</p>
                    <p className="text-red-700/80 mt-0.5">
                        You won't hear a sound or see a popup for new orders unless this tab is open. Enable notifications for
                        this site in your browser settings to avoid missing orders.
                    </p>
                </div>
                <button
                    onClick={handleDismiss}
                    className="text-red-400 hover:text-red-600 shrink-0"
                    aria-label="Dismiss"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="mx-4 md:mx-0 mt-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
            <BellRing className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-amber-900">
                <p className="font-medium">Turn on order alerts</p>
                <p className="text-amber-800/80 mt-0.5">
                    Right now you only hear the order sound while this tab is open. Enable notifications so you get a sound
                    and popup for new orders even when minimized or on another app.
                </p>
                <button
                    onClick={handleEnable}
                    disabled={isEnabling}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                >
                    <BellRing className="w-3.5 h-3.5" />
                    {isEnabling ? 'Enabling…' : 'Enable order alerts'}
                </button>
            </div>
            <button
                onClick={handleDismiss}
                className="text-amber-400 hover:text-amber-600 shrink-0"
                aria-label="Dismiss"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

export default NotificationPermissionBanner;
