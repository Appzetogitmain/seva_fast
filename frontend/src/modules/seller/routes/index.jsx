import React, { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import DashboardLayout from "@shared/layout/DashboardLayout";
import Orders from "../pages/Orders";
import { socketService } from "@core/services/socket";
import { toast } from "sonner";
import {
  HiOutlineSquares2X2,
  HiOutlineCube,
  HiOutlineCurrencyDollar,
  HiOutlineUser,
  HiOutlineTruck,
  HiOutlineArchiveBox,
  HiOutlineChartBarSquare,
  HiOutlineCreditCard,
  HiOutlineMapPin,
  HiOutlinePhoto,
} from "react-icons/hi2";

const Dashboard = React.lazy(() => import("../pages/Dashboard"));
const ProductManagement = React.lazy(
  () => import("../pages/ProductManagement"),
);
const StockManagement = React.lazy(() => import("../pages/StockManagement"));
const AddProduct = React.lazy(() => import("../pages/AddProduct"));
const BulkUploadProducts = React.lazy(() => import("../pages/BulkUploadProducts"));
// Note: Orders is imported eagerly above to avoid dynamic import issues
const Returns = React.lazy(() => import("../pages/Returns"));
const Earnings = React.lazy(() => import("../pages/Earnings"));
const Analytics = React.lazy(() => import("../pages/Analytics"));
const Transactions = React.lazy(() => import("../pages/Transactions"));
const DeliveryTracking = React.lazy(() => import("../pages/DeliveryTracking"));
const Profile = React.lazy(() => import("../pages/Profile"));
const Withdrawals = React.lazy(() => import("../pages/Withdrawals"));
const CustomOrders = React.lazy(() => import("../pages/CustomOrders"));
const CodCash = React.lazy(() => import("../pages/CodCash"));

const ActiveDeliveryBoys = React.lazy(
  () => import("../../admin/pages/ActiveDeliveryBoys"),
);
const PendingDeliveryBoys = React.lazy(
  () => import("../../admin/pages/PendingDeliveryBoys"),
);
const DeliveryFunds = React.lazy(() => import("../../admin/pages/DeliveryFunds"));
const FleetTracking = React.lazy(() => import("../../admin/pages/FleetTracking"));

const navItems = [
  { label: "Dashboard", path: "/seller", icon: HiOutlineSquares2X2, end: true },
  { label: "Products", path: "/seller/products", icon: HiOutlineCube },
  { label: "Stock", path: "/seller/inventory", icon: HiOutlineArchiveBox },
  { label: "Orders", path: "/seller/orders", icon: HiOutlineTruck },
  { label: "Photo Orders", path: "/seller/photo-orders", icon: HiOutlinePhoto },
  { label: "Returns", path: "/seller/returns", icon: HiOutlineArchiveBox },
  { label: "Track Orders", path: "/seller/tracking", icon: HiOutlineMapPin },
  {
    label: "Delivery Drivers",
    icon: HiOutlineTruck,
    children: [
      { label: "Active Drivers", path: "/seller/delivery-boys/active" },
      { label: "Waiting for Review", path: "/seller/delivery-boys/pending" },
      { label: "Track Drivers", path: "/seller/fleet-tracking" },
      { label: "Send Money", path: "/seller/delivery-funds" },
    ],
  },
  {
    label: "Sales Reports",
    path: "/seller/analytics",
    icon: HiOutlineChartBarSquare,
  },
  {
    label: "Money Request",
    path: "/seller/withdrawals",
    icon: HiOutlineCurrencyDollar,
  },
  {
    label: "Payment History",
    path: "/seller/transactions",
    icon: HiOutlineCreditCard,
  },
  {
    label: "Earnings",
    path: "/seller/earnings",
    icon: HiOutlineCurrencyDollar,
  },
  {
    label: "COD Cash",
    path: "/seller/cod-cash",
    icon: HiOutlineCurrencyDollar,
  },
  { label: "Profile", path: "/seller/profile", icon: HiOutlineUser },
];

const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

const SellerRoutes = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleNewPhotoOrder = (order) => {
      playBeep();
      toast.custom((t) => (
        <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-indigo-500 flex flex-col gap-2 w-80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
              <HiOutlinePhoto size={20} />
            </div>
            <div>
              <h4 className="font-bold text-gray-900">New Photo Order!</h4>
              <p className="text-sm text-gray-500">From a customer</p>
            </div>
          </div>
          <button 
            onClick={() => {
              toast.dismiss(t);
              navigate("/seller/photo-orders");
            }}
            className="mt-2 w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            View Order
          </button>
        </div>
      ), { duration: 8000 });
    };

    socketService.on("new_photo_order", handleNewPhotoOrder);
    return () => socketService.off("new_photo_order", handleNewPhotoOrder);
  }, [navigate]);

  return (
    <DashboardLayout navItems={navItems} title="Seller Panel">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<ProductManagement />} />
        <Route path="/products/add" element={<AddProduct />} />
        <Route path="/products/bulk" element={<BulkUploadProducts />} />
        <Route path="/inventory" element={<StockManagement />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/photo-orders" element={<CustomOrders />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/tracking" element={<DeliveryTracking />} />
        <Route path="/delivery-boys/active" element={<ActiveDeliveryBoys />} />
        <Route path="/delivery-boys/pending" element={<PendingDeliveryBoys />} />
        <Route path="/fleet-tracking" element={<FleetTracking />} />
        <Route path="/delivery-funds" element={<DeliveryFunds />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/earnings" element={<Earnings />} />
        <Route path="/cod-cash" element={<CodCash />} />
        <Route path="/withdrawals" element={<Withdrawals />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardLayout>
  );
};

export default SellerRoutes;
