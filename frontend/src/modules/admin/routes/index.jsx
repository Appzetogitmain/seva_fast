import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "@shared/layout/DashboardLayout";
import { useSupportUnread } from "@core/context/SupportUnreadContext";
import { useAuth } from "@core/context/AuthContext";
import { useEffect } from "react";
import { getOrderSocket } from "@/core/services/orderSocket";
import AdminChatbotWidget from "../components/AdminChatbotWidget";
import {
  LayoutDashboard,
  Tag,
  Box,
  Store,
  Truck,
  Wallet,
  Banknote,
  Receipt,
  CircleDollarSign,
  Users,
  HelpCircle,
  ClipboardList,
  RotateCcw,
  Settings,
  Terminal,
  Sparkles,
  User,
  Briefcase,
  Shield,
  MapPin,
  History,
  PieChart,
  FileText,
  Star,
} from "lucide-react";

const Dashboard = React.lazy(() => import("../pages/Dashboard"));
const ProfessionalAdsManagement = React.lazy(
  () => import("../pages/ProfessionalAdsManagement"),
);
const CategoryManagement = React.lazy(
  () => import("../pages/CategoryManagement"),
);
const HeaderCategories = React.lazy(
  () => import("../pages/categories/HeaderCategories"),
);
const Level2Categories = React.lazy(
  () => import("../pages/categories/Level2Categories"),
);
const SubCategories = React.lazy(
  () => import("../pages/categories/SubCategories"),
);
const CategoryHierarchy = React.lazy(
  () => import("../pages/categories/CategoryHierarchy"),
);
const ProductManagement = React.lazy(
  () => import("../pages/ProductManagement"),
);
const ActiveSellers = React.lazy(() => import("../pages/ActiveSellers"));
const PendingSellers = React.lazy(() => import("../pages/PendingSellers"));
const SellerLocations = React.lazy(() => import("../pages/SellerLocations"));
const ActiveDeliveryBoys = React.lazy(
  () => import("../pages/ActiveDeliveryBoys"),
);
const PendingDeliveryBoys = React.lazy(
  () => import("../pages/PendingDeliveryBoys"),
);
const DeliveryFunds = React.lazy(() => import("../pages/DeliveryFunds"));
const AdminWallet = React.lazy(() => import("../pages/AdminWallet"));
const CommissionSplitsReport = React.lazy(() => import("../pages/CommissionSplitsReport"));
const WithdrawalRequests = React.lazy(
  () => import("../pages/WithdrawalRequests"),
);
const SellerTransactions = React.lazy(
  () => import("../pages/SellerTransactions"),
);
const CashCollection = React.lazy(() => import("../pages/CashCollection"));
const CustomerManagement = React.lazy(
  () => import("../pages/CustomerManagement"),
);
const CustomerDetail = React.lazy(() => import("../pages/CustomerDetail"));
const ReferralsAndSubscriptions = React.lazy(() => import("../pages/ReferralsAndSubscriptions"));
const UserManagement = React.lazy(() => import("../pages/UserManagement"));
const ZoneManagement = React.lazy(() => import("../pages/ZoneManagement"));
const Profile = React.lazy(() => import("@/pages/Profile"));
const FAQManagement = React.lazy(() => import("../pages/FAQManagement"));
const OrdersList = React.lazy(() => import("../pages/OrdersList"));
const OrderDetail = React.lazy(() => import("../pages/OrderDetail"));
const Returns = React.lazy(() => import("../pages/Returns"));
const SellerDetail = React.lazy(() => import("../pages/SellerDetail"));
const SupportTickets = React.lazy(() => import("../pages/SupportTickets"));
const FleetTracking = React.lazy(() => import("../pages/FleetTracking"));
const CouponManagement = React.lazy(() => import("../pages/CouponManagement"));
const ContentManager = React.lazy(() => import("../pages/ContentManager"));
const HeroCategoriesPerPage = React.lazy(() => import("../pages/HeroCategoriesPerPage"));
const NotificationComposer = React.lazy(
  () => import("../pages/NotificationComposer"),
);
const OffersManagement = React.lazy(
  () => import("../pages/OffersManagement"),
);
const OfferSectionsManagement = React.lazy(
  () => import("../pages/OfferSectionsManagement"),
);
const ShopByStoreManagement = React.lazy(
  () => import("../pages/ShopByStoreManagement"),
);
const AdminSettings = React.lazy(() => import("../pages/AdminSettings"));
const AdminLegalDocuments = React.lazy(() => import("../pages/AdminLegalDocuments"));
const EnvSettings = React.lazy(() => import("../pages/EnvSettings"));
const AuthActivityLogs = React.lazy(() => import("../pages/AuthActivityLogs"));
const AdminProfile = React.lazy(() => import("../pages/AdminProfile"));
const PlanManagement = React.lazy(() => import("../pages/PlanManagement"));
const AdminReviews = React.lazy(() => import("../pages/AdminReviews"));
// const WhatsAppCampaigns = React.lazy(() => import("../pages/WhatsAppCampaigns"));
// const WhatsAppTemplates = React.lazy(() => import("../pages/WhatsAppTemplates"));
const StorePromotions = React.lazy(() => import("../pages/StorePromotions"));
const AdminPhotoOrders = React.lazy(() => import("../pages/AdminPhotoOrders"));

const navItems = [
  {
    label: "Dashboard",
    path: "/admin",
    icon: LayoutDashboard,
    color: "indigo",
    end: true,
  },
  {
    label: "Categories",
    icon: Tag,
    color: "rose",
    children: [
      { label: "All Categories", path: "/admin/categories/hierarchy" },
      { label: "Header Categories", path: "/admin/categories/header" },
      { label: "Main Categories", path: "/admin/categories/level2" },
      { label: "Sub-Categories", path: "/admin/categories/sub" },
    ],
  },
  {
    label: "Professional Directory",
    path: "/admin/professional-directory",
    icon: Briefcase,
    color: "teal",
  },
  { label: "Products", path: "/admin/products", icon: Box, color: "amber" },
  { label: "Product Reviews", path: "/admin/reviews", icon: Star, color: "yellow" },
  {
    label: "Marketing Tools",
    icon: Sparkles,
    color: "amber",
    children: [
      { label: "Store Promotions", path: "/admin/store-promotions" },
      { label: "Create Sections", path: "/admin/experience-studio" },
      { label: "Hero & categories per page", path: "/admin/hero-categories" },
      { label: "Send Notifications", path: "/admin/notifications" },
      // { label: "WhatsApp Campaigns", path: "/admin/whatsapp-campaigns" },
      // { label: "WhatsApp Templates", path: "/admin/whatsapp-templates" },
      { label: "Coupons & Promos", path: "/admin/coupons" },
      { label: "Offer Sections", path: "/admin/offer-sections" },
      { label: "Shop by Store", path: "/admin/shop-by-store" },
    ],
  },
  {
    label: "Customer Support",
    path: "/admin/support-tickets",
    icon: Receipt,
    color: "emerald",
  },
  {
    label: "Sellers",
    icon: Store,
    color: "blue",
    children: [
      { label: "Active Sellers", path: "/admin/sellers/active" },
      { label: "Waiting for Review", path: "/admin/sellers/pending" },
      { label: "Seller Locations", path: "/admin/seller-locations" },
    ],
  },
  {
    label: "Delivery Drivers",
    icon: Truck,
    color: "emerald",
    children: [
      { label: "Active Drivers", path: "/admin/delivery-boys/active" },
      { label: "Waiting for Review", path: "/admin/delivery-boys/pending" },
      { label: "Track Drivers", path: "/admin/tracking" },
      { label: "Send Money", path: "/admin/delivery-funds" },
    ],
  },
  { label: "Wallet", path: "/admin/wallet", icon: Wallet, color: "violet" },
  {
    label: "Commission Splits",
    path: "/admin/commission-splits",
    icon: PieChart,
    color: "fuchsia",
  },
  {
    label: "Money Requests",
    path: "/admin/withdrawals",
    icon: Banknote,
    color: "cyan",
  },
  {
    label: "Seller Payments",
    path: "/admin/seller-transactions",
    icon: Receipt,
    color: "orange",
  },
  {
    label: "Collect Cash",
    path: "/admin/cash-collection",
    icon: CircleDollarSign,
    color: "green",
  },
  { label: "Customers", path: "/admin/customers", icon: Users, color: "sky" },
  {
    label: "Sub-Admins",
    path: "/admin/users",
    icon: Shield,
    color: "indigo",
  },
  {
    label: "Zones",
    path: "/admin/zones",
    icon: MapPin,
    color: "rose",
  },
  { label: "Referrals & Plans", path: "/admin/referrals-plans", icon: Sparkles, color: "amber" },
  { label: "FAQs", path: "/admin/faqs", icon: HelpCircle, color: "pink" },
  {
    label: "Orders",
    icon: ClipboardList,
    color: "fuchsia",
    children: [
      { label: "All Orders", path: "/admin/orders/all" },
      { label: "New Orders", path: "/admin/orders/pending" },
      { label: "Being Prepared", path: "/admin/orders/processed" },
      { label: "On the Way", path: "/admin/orders/out-for-delivery" },
      { label: "Delivered", path: "/admin/orders/delivered" },
      { label: "Cancelled", path: "/admin/orders/cancelled" },
      { label: "Returned", path: "/admin/orders/returned" },
      { label: "Return Requests", path: "/admin/returns" },
      { label: "Photo Orders", path: "/admin/photo-orders" },
    ],
  },
  {
    label: "Fees & Charges",
    path: "/admin/billing",
    icon: RotateCcw,
    color: "red",
  },
  {
    label: "Legal Documents",
    path: "/admin/legal-documents",
    icon: FileText,
    color: "indigo",
  },
  {
    label: "Settings",
    path: "/admin/settings",
    icon: Settings,
    color: "slate",
  },
  {
    label: "Subscription Plans",
    path: "/admin/plans",
    icon: Sparkles,
    color: "amber",
  },
  { label: "My Profile", path: "/admin/profile", icon: User, color: "indigo" },
  { label: "Login Activity", path: "/admin/login-activity", icon: History, color: "cyan" },
  { label: "System Settings", path: "/admin/env", icon: Terminal, color: "dark" },
];

const BillingCharges = React.lazy(() => import("../pages/BillingCharges"));

const AdminRoutes = () => {
  const { totalUnread } = useSupportUnread();
  const { user, logout } = useAuth();

  // Bug 255: Listen for force-logout event (when this sub-admin is deleted by super admin)
  useEffect(() => {
    if (user?.role !== "sub-admin") return;
    const getToken = () => localStorage.getItem('auth_admin');
    const socket = getOrderSocket(getToken);
    if (!socket) return;
    const handleForceLogout = () => {
      logout();
      window.location.href = '/admin/login';
    };
    socket.on('admin:force-logout', handleForceLogout);
    return () => {
      socket.off('admin:force-logout', handleForceLogout);
    };
  }, [user, logout]);

  const SubadminRoute = React.useCallback(({ permission, children }) => {
    if (user?.role === "sub-admin") {
      const allowed = Array.isArray(user.allowedPermissions) && user.allowedPermissions.includes(permission);
      if (!allowed) {
        return <Navigate to="/admin/profile" replace />;
      }
    }
    return children;
  }, [user]);

  const navItemsWithBadges = React.useMemo(() => {
    const count = Number.isFinite(totalUnread) ? totalUnread : 0;
    let filteredItems = navItems;

    if (user?.role === "sub-admin") {
      const allowedPerms = Array.isArray(user.allowedPermissions) ? user.allowedPermissions : [];
      filteredItems = navItems.filter(item => {
        if (item.label === "My Profile") return true;
        return allowedPerms.includes(item.label);
      });
    }

    if (count <= 0) return filteredItems;
    return filteredItems.map((item) => {
      if (item?.label !== "Customer Support") return item;
      return { ...item, badgeCount: count };
    });
  }, [totalUnread, user]);

  return (
    <DashboardLayout navItems={navItemsWithBadges} title="Admin Center">
      <AdminChatbotWidget />
      <Routes>
        <Route path="/" element={<SubadminRoute permission="Dashboard"><Dashboard /></SubadminRoute>} />
        <Route path="/users" element={<SubadminRoute permission="Sub-Admins"><UserManagement /></SubadminRoute>} />
        <Route path="/zones" element={<SubadminRoute permission="Zones"><ZoneManagement /></SubadminRoute>} />
        <Route path="/profile" element={<AdminProfile />} />
        {/* Lazy routes for new sections */}
        <Route
          path="/categories"
          element={<Navigate to="/admin/categories/header" replace />}
        />
        <Route path="/categories/header" element={<SubadminRoute permission="Categories"><HeaderCategories /></SubadminRoute>} />
        <Route path="/categories/level2" element={<SubadminRoute permission="Categories"><Level2Categories /></SubadminRoute>} />
        <Route path="/categories/sub" element={<SubadminRoute permission="Categories"><SubCategories /></SubadminRoute>} />
        <Route path="/categories/hierarchy" element={<SubadminRoute permission="Categories"><CategoryHierarchy /></SubadminRoute>} />
        <Route path="/products" element={<SubadminRoute permission="Products"><ProductManagement /></SubadminRoute>} />
        <Route path="/reviews" element={<SubadminRoute permission="Products"><AdminReviews /></SubadminRoute>} />
        <Route path="/sellers/active" element={<SubadminRoute permission="Sellers"><ActiveSellers /></SubadminRoute>} />
        <Route path="/sellers/active/:id" element={<SubadminRoute permission="Sellers"><SellerDetail /></SubadminRoute>} />
        <Route path="/support-tickets" element={<SubadminRoute permission="Customer Support"><SupportTickets /></SubadminRoute>} />
        <Route path="/moderation" element={<Navigate to="/admin/support-tickets" replace />} />
        <Route path="/experience-studio" element={<SubadminRoute permission="Marketing Tools"><ContentManager /></SubadminRoute>} />
        <Route path="/hero-categories" element={<SubadminRoute permission="Marketing Tools"><HeroCategoriesPerPage /></SubadminRoute>} />
        <Route path="/notifications" element={<SubadminRoute permission="Marketing Tools"><NotificationComposer /></SubadminRoute>} />
        {/* <Route path="/whatsapp-campaigns" element={<SubadminRoute permission="Marketing Tools"><WhatsAppCampaigns /></SubadminRoute>} /> */}
        {/* <Route path="/whatsapp-templates" element={<SubadminRoute permission="Marketing Tools"><WhatsAppTemplates /></SubadminRoute>} /> */}
        <Route path="/store-promotions" element={<SubadminRoute permission="Marketing Tools"><StorePromotions /></SubadminRoute>} />
        <Route path="/offers" element={<SubadminRoute permission="Marketing Tools"><OffersManagement /></SubadminRoute>} />
        <Route path="/offer-sections" element={<SubadminRoute permission="Marketing Tools"><OfferSectionsManagement /></SubadminRoute>} />
        <Route path="/shop-by-store" element={<SubadminRoute permission="Marketing Tools"><ShopByStoreManagement /></SubadminRoute>} />
        <Route path="/coupons" element={<SubadminRoute permission="Marketing Tools"><CouponManagement /></SubadminRoute>} />
        <Route path="/sellers/pending" element={<SubadminRoute permission="Sellers"><PendingSellers /></SubadminRoute>} />
        <Route path="/seller-locations" element={<SubadminRoute permission="Sellers"><SellerLocations /></SubadminRoute>} />
        <Route path="/delivery-boys/active" element={<SubadminRoute permission="Delivery Drivers"><ActiveDeliveryBoys /></SubadminRoute>} />
        <Route
          path="/delivery-boys/pending"
          element={<SubadminRoute permission="Delivery Drivers"><PendingDeliveryBoys /></SubadminRoute>}
        />
        <Route path="/tracking" element={<SubadminRoute permission="Delivery Drivers"><FleetTracking /></SubadminRoute>} />
        <Route path="/delivery-funds" element={<SubadminRoute permission="Delivery Drivers"><DeliveryFunds /></SubadminRoute>} />
        <Route path="/wallet" element={<SubadminRoute permission="Wallet"><AdminWallet /></SubadminRoute>} />
        <Route path="/commission-splits" element={<SubadminRoute permission="Wallet"><CommissionSplitsReport /></SubadminRoute>} />
        <Route path="/withdrawals" element={<SubadminRoute permission="Money Requests"><WithdrawalRequests /></SubadminRoute>} />
        <Route path="/seller-transactions" element={<SubadminRoute permission="Seller Payments"><SellerTransactions /></SubadminRoute>} />
        <Route path="/cash-collection" element={<SubadminRoute permission="Collect Cash"><CashCollection /></SubadminRoute>} />
        <Route path="/customers" element={<SubadminRoute permission="Customers"><CustomerManagement /></SubadminRoute>} />
        <Route path="/customers/:id" element={<SubadminRoute permission="Customers"><CustomerDetail /></SubadminRoute>} />
        <Route path="/referrals-plans" element={<SubadminRoute permission="Referrals & Plans"><ReferralsAndSubscriptions /></SubadminRoute>} />
        <Route path="/faqs" element={<SubadminRoute permission="FAQs"><FAQManagement /></SubadminRoute>} />
        <Route path="/orders/:status" element={<SubadminRoute permission="Orders"><OrdersList /></SubadminRoute>} />
        <Route path="/orders/view/:orderId" element={<SubadminRoute permission="Orders"><OrderDetail /></SubadminRoute>} />
        <Route path="/returns" element={<SubadminRoute permission="Orders"><Returns /></SubadminRoute>} />
        <Route path="/photo-orders" element={<SubadminRoute permission="Orders"><AdminPhotoOrders /></SubadminRoute>} />
        <Route path="/billing" element={<SubadminRoute permission="Fees & Charges"><BillingCharges /></SubadminRoute>} />
        <Route path="/legal-documents" element={<SubadminRoute permission="Legal Documents"><AdminLegalDocuments /></SubadminRoute>} />
        <Route path="/settings" element={<SubadminRoute permission="Settings"><AdminSettings /></SubadminRoute>} />
        <Route path="/env" element={<SubadminRoute permission="System Settings"><EnvSettings /></SubadminRoute>} />
        <Route path="/login-activity" element={<SubadminRoute permission="Login Activity"><AuthActivityLogs /></SubadminRoute>} />
        <Route path="/plans" element={<SubadminRoute permission="Subscription Plans"><PlanManagement /></SubadminRoute>} />
        <Route path="/professional-directory" element={<SubadminRoute permission="Professional Directory"><ProfessionalAdsManagement /></SubadminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardLayout>
  );
};

export default AdminRoutes;
