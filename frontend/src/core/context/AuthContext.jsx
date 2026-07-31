import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import axiosInstance from '@core/api/axios';
import { getWithDedupe } from '@core/api/dedupe';
import { getStoredAuthToken } from '@core/utils/authStorage';

const AuthContext = createContext(undefined);

const ROLE_STORAGE_KEYS = {
    customer: 'auth_customer',
    seller: 'auth_seller',
    admin: 'auth_admin',
    delivery: 'auth_delivery'
};

const LEGACY_TOKEN_KEY = 'token';

export const AuthProvider = ({ children }) => {
    // Current role based on URL
    const getCurrentRoleFromUrl = () => {
        const path = window.location.pathname;
        if (path.startsWith('/seller')) return 'seller';
        if (path.startsWith('/admin')) return 'admin';
        if (path.startsWith('/delivery')) return 'delivery';
        return 'customer';
    };

    const getSafeToken = (key) => getStoredAuthToken(ROLE_STORAGE_KEYS[key]);

    const [authData, setAuthData] = useState({
        customer: getSafeToken('customer'),
        seller: getSafeToken('seller'),
        admin: getSafeToken('admin'),
        delivery: getSafeToken('delivery'),
    });

    const currentRole = getCurrentRoleFromUrl();
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [profileRefreshKey, setProfileRefreshKey] = useState(0);
    const token = authData[currentRole];
    const isAuthenticated = !!token;

    useEffect(() => {
        let onlineRefreshTimer = null;

        const readStoredTokens = () => ({
            customer: getSafeToken('customer'),
            seller: getSafeToken('seller'),
            admin: getSafeToken('admin'),
            delivery: getSafeToken('delivery'),
        });

        const syncStoredTokens = () => {
            setAuthData(readStoredTokens());
        };

        const refreshProfileAfterReconnect = () => {
            if (onlineRefreshTimer) {
                clearTimeout(onlineRefreshTimer);
            }
            onlineRefreshTimer = setTimeout(() => {
                setAuthData(readStoredTokens());
                setProfileRefreshKey((prev) => prev + 1);
            }, 1500);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Re-read WebView localStorage without forcing a profile refetch.
                syncStoredTokens();
            }
        };

        window.addEventListener('focus', syncStoredTokens);
        window.addEventListener('storage', syncStoredTokens);
        window.addEventListener('online', refreshProfileAfterReconnect);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (onlineRefreshTimer) {
                clearTimeout(onlineRefreshTimer);
            }
            window.removeEventListener('focus', syncStoredTokens);
            window.removeEventListener('storage', syncStoredTokens);
            window.removeEventListener('online', refreshProfileAfterReconnect);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Allow Flutter wrapper to restore JWT from native secure storage into WebView.
    useEffect(() => {
        window.SevaFastRestoreAuth = (rawToken, role = 'customer') => {
            const normalizedRole = String(role || 'customer').toLowerCase();
            const storageKey = ROLE_STORAGE_KEYS[normalizedRole];
            const tokenValue = String(rawToken || '').trim();
            if (!storageKey || !tokenValue) return false;

            localStorage.setItem(storageKey, tokenValue);
            setAuthData((prev) => ({ ...prev, [normalizedRole]: tokenValue }));
            setProfileRefreshKey((prev) => prev + 1);
            return true;
        };

        return () => {
            delete window.SevaFastRestoreAuth;
        };
    }, []);

    // Register FCM token after login (non-blocking).
    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        let cleanupDeferredRegistration = null;

        // Fire-and-forget; never block auth/profile load.
        setTimeout(() => {
            import('@core/firebase/pushClient')
                .then(async ({
                    ensureFcmTokenRegistered,
                    hasRegisteredFcmToken,
                    startForegroundPushListener,
                    scheduleFcmRegistrationOnUserGesture
                }) => {
                    if (cancelled) return;
                    await startForegroundPushListener();
                    if (hasRegisteredFcmToken(currentRole)) return;

                    const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
                    if (permission === 'granted') {
                        await ensureFcmTokenRegistered({
                            role: currentRole,
                            platform: 'web'
                        });
                        return;
                    }

                    cleanupDeferredRegistration = scheduleFcmRegistrationOnUserGesture({
                        role: currentRole,
                        platform: 'web',
                        onError: (error) => {
                            console.warn('[push] Deferred registration failed:', error?.message || error);
                        },
                    });
                })
                .catch((error) => {
                    // Permission denied / unsupported / any error: user can retry later from push-enabled actions.
                    console.warn('[push] Auto-registration skipped:', error?.message || error);
                });
        }, 0);

        return () => {
            cancelled = true;
            if (typeof cleanupDeferredRegistration === 'function') {
                cleanupDeferredRegistration();
            }
        };
    }, [token, currentRole]);

    // Fetch user profile on mount or token change
    useEffect(() => {
        const fetchProfile = async () => {
            if (token) {
                try {
                    setIsLoading(true);
                    // Use deduplicated fetch to avoid multiple simultaneous profile calls
                    const endpoint = `/${currentRole}/profile`;
                    const response = await getWithDedupe(endpoint, {}, { ttl: 5000 });
                    setUser(response.data.result);
                } catch (error) {
                    console.error('Failed to fetch profile:', error);
                    const statusCode = error?.response?.status;
                    // Only clear session for confirmed auth failures (401).
                    // 403 can be role/plan restrictions and should not log users out.
                    if (statusCode === 401) {
                        const storageKey = ROLE_STORAGE_KEYS[currentRole];
                        if (storageKey) {
                            localStorage.removeItem(storageKey);
                        }
                        setAuthData((prev) => ({
                            ...prev,
                            [currentRole]: null,
                        }));
                        setUser(null);
                    }
                } finally {
                    setIsLoading(false);
                }
            } else {
                setUser(null);
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [token, currentRole, profileRefreshKey]);

    const login = (userData) => {
        const role = userData.role?.toLowerCase() || 'customer';
        const storageKey = ROLE_STORAGE_KEYS[role];

        if (storageKey && userData.token) {
            localStorage.setItem(storageKey, userData.token);

            setAuthData(prev => ({ ...prev, [role]: userData.token }));
            setUser(userData);

            // Mirror token to Flutter native storage when running inside the wrapper.
            if (window.Flutter) {
                try {
                    window.Flutter.postMessage(
                        JSON.stringify({
                            type: 'save_auth_token',
                            role,
                            token: userData.token,
                        })
                    );
                } catch (error) {
                    console.warn('[auth] Failed to persist token to Flutter bridge:', error);
                }
            }
        } else {
            console.error('Invalid role or missing token for login:', role);
        }
    };

    const updateUser = (userData) => {
        setUser((prev) => ({ ...(prev || {}), ...(userData || {}) }));
    };

    const logout = async () => {
        const storageKey = ROLE_STORAGE_KEYS[currentRole];

        if (token) {
            try {
                await axiosInstance.post('/auth/activity/logout');
            } catch (error) {
                console.warn('Failed to record logout activity:', error);
            }
        }

        try {
            const { removeStoredFcmToken } = await import('@core/firebase/pushClient');
            await removeStoredFcmToken({ role: currentRole });
        } catch (error) {
            console.warn('Failed to remove push token during logout:', error);
        }

        if (storageKey) {
            localStorage.removeItem(storageKey);
        }

        // Remove the legacy shared token only when it belongs to the current role session.
        if (token && localStorage.getItem(LEGACY_TOKEN_KEY) === token) {
            localStorage.removeItem(LEGACY_TOKEN_KEY);
        }

        sessionStorage.removeItem(`push:registered:${currentRole}`);
        localStorage.removeItem(`push:fcm-token:${currentRole}`);

        setAuthData((prev) => ({
            ...prev,
            [currentRole]: null,
        }));

        setUser(null);

        if (window.Flutter) {
            try {
                window.Flutter.postMessage(
                    JSON.stringify({
                        type: 'clear_auth_token',
                        role: currentRole,
                    })
                );
            } catch (error) {
                console.warn('[auth] Failed to clear token in Flutter bridge:', error);
            }
        }

        // Final fallback: redirect based on current path if needed
        // (ProtectedRoute usually handles this, but explicit navigation is safer for some UI edge cases)
        const path = window.location.pathname;
        if (path.startsWith('/admin')) window.location.href = '/admin/auth';
        else if (path.startsWith('/seller')) window.location.href = '/seller/auth';
        else if (path.startsWith('/delivery')) window.location.href = '/delivery/auth';
        else window.location.href = '/login';
    };

    const refreshUser = async () => {
        if (token) {
            try {
                const endpoint = `/${currentRole}/profile`;
                const response = await axiosInstance.get(endpoint);
                setUser(response.data.result);
                return response.data.result;
            } catch (error) {
                console.error('Failed to refresh profile:', error);
            }
        }
    };

    const value = useMemo(() => ({
        user,
        token,
        role: currentRole,
        isAuthenticated,
        isLoading,
        authData,
        login,
        updateUser,
        logout,
        refreshUser
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [user, token, currentRole, isAuthenticated, isLoading, authData]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
