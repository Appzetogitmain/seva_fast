import React, { useEffect, useState } from 'react';
import Header from './Header';
import Footer from './Footer';
import BottomNav from './BottomNav';
import MiniCart from '../shared/MiniCart';
import MobileFooterMessage from './MobileFooterMessage';
import BirthdayHeaderCelebration from '../shared/BirthdayHeaderCelebration';
import WelcomeScratchCardModal from '../WelcomeScratchCardModal';
import { customerApi } from '../../services/customerApi';
import { useProductDetail } from '../../context/ProductDetailContext';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { onReturnPickupOtp, onReturnDropOtp, onPhotoOrderMessage, onPhotoOrderStatusAlert } from '@core/services/orderSocket';
import { toast } from 'sonner';
import { ShieldCheck, Package, MessageSquare, ChevronRight, Camera } from 'lucide-react';
import { isBirthdayToday } from '@shared/utils/birthdayUtils';
import { notificationSound } from '@core/utils/notificationSound';

const CustomerLayout = ({ children, showHeader: showHeaderProp, fullHeight = false, showCart: showCartProp, showBottomNav: showBottomNavProp }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isOpen: isProductDetailOpen } = useProductDetail();
    const { user, token } = useAuth();
    const isBirthday = !!user?.dateOfBirth && isBirthdayToday(user.dateOfBirth);

    const [welcomeOffer, setWelcomeOffer] = useState({
        isOpen: false,
        discountPercent: 10,
        freeDelivery: true,
    });

    useEffect(() => {
        const fetchEligibility = async () => {
            try {
                const res = await customerApi.getFirstOrderEligibility();
                const data = res.data?.result ?? res.data;
                if (data && data.isFirstOrder && data.welcomeScratchCardEnabled !== false) {
                    const userIdKey = user?._id || user?.id || 'guest';
                    const storageKey = `welcome_scratch_card_done_${userIdKey}`;
                    if (localStorage.getItem(storageKey) !== 'true') {
                        setWelcomeOffer({
                            isOpen: true,
                            discountPercent: data.firstOrderDiscountPercent ?? 10,
                            freeDelivery: data.firstOrderFreeDelivery !== false,
                        });
                    }
                }
            } catch (err) {
                console.error("[CustomerLayout] Error checking first order eligibility:", err);
            }
        };
        if (!user) return;
        fetchEligibility();
    }, [user]);

    // Listen for Return OTPs & Photo Order Messages (Real-time Alert for Customer)
    useEffect(() => {
        if (!token || !user) return;

        const cleanupPickup = onReturnPickupOtp(() => token, (payload) => {
            console.log('[CustomerLayout] Return Pickup OTP Received:', payload);
            toast.custom((t) => (
                <div className="bg-white border-2 border-brand-600 rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-full duration-500 max-w-md w-full">
                    <div className="flex items-start gap-4">
                        <div className="h-12 w-12 bg-brand-100 rounded-2xl flex items-center justify-center text-brand-600 shrink-0">
                            <ShieldCheck size={28} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-black text-slate-900 leading-tight mb-1">Return Pickup OTP</h3>
                            <p className="text-sm text-slate-500 font-medium mb-3">
                                Share this code with the delivery partner to confirm your return pickup.
                            </p>
                            <div className="flex items-center gap-2">
                                <span className="text-3xl font-black tracking-[0.2em] text-brand-600 bg-brand-50 px-4 py-2 rounded-xl border border-brand-100">
                                    {payload.otp}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ), { duration: 15000, position: 'top-center' });
        });

        const cleanupDrop = onReturnDropOtp(() => token, (payload) => {
            console.log('[CustomerLayout] Return Drop OTP Received:', payload);
            toast.custom((t) => (
                <div className="bg-white border-2 border-green-600 rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-full duration-500 max-w-md w-full">
                    <div className="flex items-start gap-4">
                        <div className="h-12 w-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 shrink-0">
                            <Package size={28} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-black text-slate-900 leading-tight mb-1">Return Received Alert</h3>
                            <p className="text-sm text-slate-500 font-medium mb-3">
                                Use this code to confirm that your return has reached the seller.
                            </p>
                            <div className="flex items-center gap-2">
                                <span className="text-3xl font-black tracking-[0.2em] text-green-600 bg-green-50 px-4 py-2 rounded-xl border border-green-100">
                                    {payload.otp}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ), { duration: 15000, position: 'top-center' });
        });

        // Real-time Photo Order Message Alert
        const cleanupPhotoMessage = onPhotoOrderMessage(() => token, (payload) => {
            console.log('[CustomerLayout] Photo Order Message Received:', payload);
            try {
                notificationSound.playOrderAlertSound();
            } catch (e) {}

            toast.custom((t) => (
                <div 
                    onClick={() => {
                        toast.dismiss(t);
                        navigate(`/orders?tab=photo&orderId=${payload.orderId || ''}`);
                    }}
                    className="bg-white border-2 border-indigo-500 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-top-full duration-300 max-w-md w-full cursor-pointer hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-start gap-3">
                        <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                            <MessageSquare size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-900 truncate">
                                    Message from {payload.sellerName || 'Seller'}
                                </h3>
                                <span className="text-[10px] bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-full shrink-0">
                                    Photo Order
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 font-medium mt-1 line-clamp-2">
                                {payload.text || 'You have received a message regarding your photo order.'}
                            </p>
                            <div className="mt-2 flex items-center gap-1 text-xs font-bold text-indigo-600">
                                <span>Tap to view & reply</span>
                                <ChevronRight size={14} />
                            </div>
                        </div>
                    </div>
                </div>
            ), { duration: 10000, position: 'top-center' });
        });

        // Real-time Photo Order Status Alert
        const cleanupPhotoStatus = onPhotoOrderStatusAlert(() => token, (payload) => {
            console.log('[CustomerLayout] Photo Order Status Alert:', payload);
            try {
                notificationSound.playOrderAlertSound();
            } catch (e) {}

            toast.custom((t) => (
                <div 
                    onClick={() => {
                        toast.dismiss(t);
                        navigate(`/orders?tab=photo&orderId=${payload.orderId || ''}`);
                    }}
                    className="bg-white border-2 border-blue-500 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-top-full duration-300 max-w-md w-full cursor-pointer hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-start gap-3">
                        <div className="h-10 w-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                            <Camera size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-900 truncate">
                                    Photo Order {payload.status}
                                </h3>
                                <span className="text-[10px] bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full shrink-0">
                                    Status Update
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 font-medium mt-1">
                                {payload.sellerName || 'The seller'} marked your photo order as {payload.status}.
                            </p>
                            <div className="mt-2 flex items-center gap-1 text-xs font-bold text-blue-600">
                                <span>Tap to view order</span>
                                <ChevronRight size={14} />
                            </div>
                        </div>
                    </div>
                </div>
            ), { duration: 10000, position: 'top-center' });
        });

        return () => {
            cleanupPickup();
            cleanupDrop();
            cleanupPhotoMessage();
            cleanupPhotoStatus();
        };
    }, [token, user, navigate]);

    // Route-based visibility logic
    const path = location.pathname.replace(/\/$/, '') || '/';

    const hideHeaderRoutes = ['/', '/categories', '/orders', '/transactions', '/profile', '/profile/edit', '/wishlist', '/addresses', '/wallet', '/support', '/privacy', '/about', '/terms', '/checkout', '/search', '/chat', '/plans', '/professionals', '/professionals/panel'];
    const hideBottomNavRoutes = ['/checkout', '/search', '/chat'];
    const hideCartRoutes = ['/checkout', '/chat'];

    // If props are passed, use them. Otherwise, use route-based logic.
    const showHeader = showHeaderProp !== undefined ? showHeaderProp : (!hideHeaderRoutes.includes(path) && !path.startsWith('/category') && !path.startsWith('/orders'));
    const showBottomNav = showBottomNavProp !== undefined ? showBottomNavProp : !hideBottomNavRoutes.includes(path);
    const showCart = showCartProp !== undefined ? showCartProp : (!hideCartRoutes.includes(path) && !path.startsWith('/orders'));

    // Condition to hide the MobileFooterMessage ("India's last minute app") on specific pages
    const hideFooterMessageRoutes = ['/profile', '/profile/edit'];
    const showFooterMessage = showBottomNav && !hideFooterMessageRoutes.includes(path) && !path.startsWith('/category');

    // Hide elements on mobile only when product detail is open
    // On desktop, we want to keep the header visible even if the modal is open
    const finalShowHeaderMobile = showHeader && !isProductDetailOpen && !path.startsWith('/product');
    const finalShowBottomNavMobile = showBottomNav && !isProductDetailOpen;
    const finalShowFooterMessageMobile = showFooterMessage && !isProductDetailOpen;

    return (
        <div className={cn("min-h-screen bg-slate-50 flex flex-col font-sans", isBirthday && "pt-9")}>
            <BirthdayHeaderCelebration variant="global" />
            {/* Header logic: Always show on desktop if showHeader is true. On mobile, hide if product detail is open. */}
            {showHeader && (
                <>
                    <div className="hidden md:block">
                        <Header />
                    </div>
                    {finalShowHeaderMobile && (
                        <div className="block md:hidden">
                            <Header />
                        </div>
                    )}
                </>
            )}

            <main className={cn("flex-1 md:pb-0", !showHeader && "pt-0", !fullHeight && "pb-16")}>
                {children}
            </main>

            {showCart && <MiniCart />}

            <div className="hidden md:block">
                <Footer />
            </div>

            {/* Mobile Footer Message logic */}
            <div className="md:hidden">
                {finalShowFooterMessageMobile && <MobileFooterMessage />}
            </div>

            {/* Bottom Nav logic */}
            <div className="md:hidden">
                {finalShowBottomNavMobile && <BottomNav />}
            </div>
            {/* Desktop Bottom Nav doesn't exist usually, but just in case of future changes */}
            {/* Welcome Scratch Card Popup */}
            <WelcomeScratchCardModal
                isOpen={welcomeOffer.isOpen}
                onClose={() => setWelcomeOffer((prev) => ({ ...prev, isOpen: false }))}
                discountPercent={welcomeOffer.discountPercent}
                freeDelivery={welcomeOffer.freeDelivery}
                userId={user?._id || user?.id || 'guest'}
            />
        </div>
    );
};

export default CustomerLayout;
