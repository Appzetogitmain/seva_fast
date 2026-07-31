import React, { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Navigate, useNavigate } from 'react-router-dom';
import ProtectedRoute from '../guards/ProtectedRoute';
import RoleGuard from '../guards/RoleGuard';
import { UserRole } from '../constants/roles';
import RootErrorBoundary from '../../shared/components/RootErrorBoundary';

// Providers for Customer Module
import { WishlistProvider } from '../../modules/customer/context/WishlistContext';
import { CartProvider } from '../../modules/customer/context/CartContext';
import { CartAnimationProvider } from '../../modules/customer/context/CartAnimationContext';
import { ProductDetailProvider } from '../../modules/customer/context/ProductDetailContext';
import { LocationProvider } from '../../modules/customer/context/LocationContext';
import ScrollToTop from '../../modules/customer/components/shared/ScrollToTop';

// Public Pages
import Auth from '../../modules/seller/pages/Auth';
import ApplicationPending from '../../modules/seller/pages/ApplicationPending';
import AdminAuth from '../../modules/admin/pages/AdminAuth';
import DeliveryAuth from '../../modules/delivery/pages/DeliveryAuth';
import DeliveryApplicationPending from '../../modules/delivery/pages/ApplicationPending';
import CustomerAuth from '../../modules/customer/pages/CustomerAuth';

// Customer Pages (lazy-loaded)
const Home = lazy(() => import('../../modules/customer/pages/Home'));
const CategoriesPage = lazy(() => import('../../modules/customer/pages/CategoriesPage'));
const CategoryProductsPage = lazy(() => import('../../modules/customer/pages/CategoryProductsPage'));
const WishlistPage = lazy(() => import('../../modules/customer/pages/WishlistPage'));
const OffersPage = lazy(() => import('../../modules/customer/pages/OffersPage'));
const ShopByStorePage = lazy(() => import('../../modules/customer/pages/ShopByStorePage'));
const ProfilePage = lazy(() => import('../../modules/customer/pages/ProfilePage'));
const OrdersPage = lazy(() => import('../../modules/customer/pages/OrdersPage'));
const OrderTransactionsPage = lazy(() => import('../../modules/customer/pages/OrderTransactionsPage'));
const AddressesPage = lazy(() => import('../../modules/customer/pages/AddressesPage'));
const SettingsPage = lazy(() => import('../../modules/customer/pages/SettingsPage'));
const SupportPage = lazy(() => import('../../modules/customer/pages/SupportPage'));
const ChatPage = lazy(() => import('../../modules/customer/pages/ChatPage'));
const TermsPage = lazy(() => import('../../modules/customer/pages/TermsPage'));
const PrivacyPage = lazy(() => import('../../modules/customer/pages/PrivacyPage'));
const AboutPage = lazy(() => import('../../modules/customer/pages/AboutPage'));
const EditProfilePage = lazy(() => import('../../modules/customer/pages/EditProfilePage'));
const OrderDetailPage = lazy(() => import('../../modules/customer/pages/OrderDetailPage'));
const ProductDetailPage = lazy(() => import('../../modules/customer/pages/ProductDetailPage'));
const CheckoutPage = lazy(() => import('../../modules/customer/pages/CheckoutPage'));
const PaymentStatusPage = lazy(() => import('../../modules/customer/pages/PaymentStatusPage'));
const SearchPage = lazy(() => import('../../modules/customer/pages/SearchPage'));
const WalletPage = lazy(() => import('../../modules/customer/pages/WalletPage'));
const PlansPage = lazy(() => import('../../modules/customer/pages/PlansPage'));
const LocalProfessionalsDirectory = lazy(() => import('../../modules/customer/pages/LocalProfessionalsDirectory'));
const ProfessionalProfilePanel = lazy(() => import('../../modules/customer/pages/ProfessionalProfilePanel'));


// Lazy load heavy modules
const SellerModule = lazy(() => import('../../modules/seller/routes/index'));
const AdminModule = lazy(() => import('../../modules/admin/routes/index'));
const DeliveryModule = lazy(() => import('../../modules/delivery/routes/index'));

import CustomerLayout from '../../modules/customer/components/layout/CustomerLayout';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import ServiceUnavailableSection from '../../shared/components/ServiceUnavailableSection';

const PlanEnforcer = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const location = useLocation();

    if (isAuthenticated && user?.role === 'customer' && !user?.currentPlan) {
        // Disabled forcing users to /plans globally so they can access the home page
        // if (!['/plans', '/terms', '/privacy', '/about'].includes(location.pathname)) {
        //     return <Navigate to="/plans" replace />;
        // }
    }
    return children;
};

/** Handles FCM / SW notification clicks without opening localhost absolute URLs. */
const PushNavigateBridge = () => {
    const navigate = useNavigate();

    useEffect(() => {
        if (typeof navigator === 'undefined' || !navigator.serviceWorker) return undefined;

        const resolvePath = (link) => {
            const raw = String(link || '').trim();
            if (!raw) return '';
            try {
                if (/^https?:\/\//i.test(raw)) {
                    const url = new URL(raw);
                    return `${url.pathname}${url.search}${url.hash}` || '/';
                }
            } catch {
                return '';
            }
            return raw.startsWith('/') ? raw : `/${raw}`;
        };

        const onMessage = (event) => {
            if (event?.data?.type !== 'push:navigate') return;
            const path = resolvePath(event.data.link);
            if (!path) return;
            navigate(path);
        };

        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }, [navigate]);

    return null;
};

const RootLayout = () => (
    <>
        <PushNavigateBridge />
        <Outlet />
    </>
);

const CustomerLayoutWrapper = () => (
    <PlanEnforcer>
        <LocationProvider>
            <WishlistProvider>
                <CartProvider>
                    <CartAnimationProvider>
                        <ProductDetailProvider>
                            <ScrollToTop />
                            <CustomerLayout>
                                <Suspense fallback={<div className="flex h-screen items-center justify-center font-outfit">Loading...</div>}>
                                    <Outlet />
                                </Suspense>
                            </CustomerLayout>
                        </ProductDetailProvider>
                    </CartAnimationProvider>
                </CartProvider>
            </WishlistProvider>
        </LocationProvider>
    </PlanEnforcer>
);

const router = createBrowserRouter([
        {
            path: '/',
            element: <RootLayout />,
            errorElement: <RootErrorBoundary />,
            children: [
                {
                    path: 'login',
                    element: <CustomerAuth />,
                },
                {
                    path: 'signup',
                    element: <CustomerAuth />,
                },
                {
                    path: 'seller/auth',
                    element: (
                        <>
                            <ScrollToTop />
                            <Auth />
                        </>
                    ),
                },
                {
                    path: 'seller/pending-approval',
                    element: (
                        <>
                            <ScrollToTop />
                            <ApplicationPending />
                        </>
                    ),
                },
                {
                    path: 'admin/auth',
                    element: <AdminAuth />,
                },
                {
                    path: 'delivery/auth',
                    element: <DeliveryAuth />,
                },
                {
                    path: 'delivery/pending-approval',
                    element: <DeliveryApplicationPending />,
                },
                {
                    path: 'seller/*',
                    element: (
                        <ProtectedRoute>
                            <RoleGuard allowedRoles={[UserRole.SELLER]}>
                                <>
                                    <ScrollToTop />
                                    <SellerModule />
                                </>
                            </RoleGuard>
                        </ProtectedRoute>
                    ),
                },
                {
                    path: 'admin/*',
                    element: (
                        <ProtectedRoute>
                            <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                                <AdminModule />
                            </RoleGuard>
                        </ProtectedRoute>
                    ),
                },
                {
                    path: 'delivery/*',
                    element: (
                        <ProtectedRoute>
                            <RoleGuard allowedRoles={[UserRole.DELIVERY]}>
                                <DeliveryModule />
                            </RoleGuard>
                        </ProtectedRoute>
                    ),
                },
                {
                    path: 'unauthorized',
                    element: <div className="flex h-screen items-center justify-center font-outfit">Unauthorized Access</div>,
                },
                {
                    path: 'service-unavailable',
                    element: (
                        <ServiceUnavailableSection
                            description="Our service is temporarily down for maintenance. Please check back shortly."
                        />
                    ),
                },
                {
                    element: <CustomerLayoutWrapper />,
                    children: [
                        { index: true, element: <Home /> },
                        { path: 'categories', element: <CategoriesPage /> },
                        { path: 'category/:categoryName', element: <CategoryProductsPage /> },
                        { path: 'product/:id', element: <ProductDetailPage /> },
                        { path: 'terms', element: <TermsPage /> },
                        { path: 'privacy', element: <PrivacyPage /> },
                        { path: 'about', element: <AboutPage /> },
                        { path: 'offers', element: <OffersPage /> },
                        { path: 'shop-by-store', element: <ShopByStorePage /> },
                        { path: 'wishlist', element: <ProtectedRoute><WishlistPage /></ProtectedRoute> },
                        { path: 'orders', element: <ProtectedRoute><OrdersPage /></ProtectedRoute> },
                        { path: 'orders/:orderId', element: <ProtectedRoute><OrderDetailPage /></ProtectedRoute> },
                        { path: 'transactions', element: <ProtectedRoute><OrderTransactionsPage /></ProtectedRoute> },
                        { path: 'addresses', element: <ProtectedRoute><AddressesPage /></ProtectedRoute> },
                        { path: 'settings', element: <ProtectedRoute><SettingsPage /></ProtectedRoute> },
                        { path: 'support', element: <ProtectedRoute><SupportPage /></ProtectedRoute> },
                        { path: 'chat', element: <ProtectedRoute><ChatPage /></ProtectedRoute> },
                        { path: 'checkout', element: <ProtectedRoute><CheckoutPage /></ProtectedRoute> },
                        { path: 'payment-status', element: <PaymentStatusPage /> },
                        { path: 'profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
                        { path: 'profile/edit', element: <ProtectedRoute><EditProfilePage /></ProtectedRoute> },
                        { path: 'wallet', element: <ProtectedRoute><WalletPage /></ProtectedRoute> },
                        { path: 'plans', element: <ProtectedRoute><PlansPage /></ProtectedRoute> },
                        { path: 'search', element: <SearchPage /> },
                        { path: 'professionals', element: <LocalProfessionalsDirectory /> },
                        { path: 'professionals/panel', element: <ProtectedRoute><ProfessionalProfilePanel /></ProtectedRoute> },
                    ]
                },
                {
                    path: '*',
                    element: <Navigate to="/" replace />
                }
            ]
        }
    ]);

const AppRouter = () => <RouterProvider router={router} />;

export default AppRouter;
