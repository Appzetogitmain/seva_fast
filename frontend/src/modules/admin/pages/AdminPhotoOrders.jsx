import React, { useState, useEffect } from "react";
import { 
    Search, 
    RefreshCw, 
    MessageSquare, 
    Image as ImageIcon,
    Clock,
    CheckCircle,
    XCircle,
    User,
    Store
} from "lucide-react";
import { adminApi } from "../services/adminApi";
import { toast } from "sonner";
import AdminPhotoOrderChatModal from "../components/AdminPhotoOrderChatModal";

const AdminPhotoOrders = () => {
    const [orders, setOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const res = await adminApi.getAdminPhotoOrders();
            const rawData = res.data?.results || res.data?.result || res.data;
            const dataArray = Array.isArray(rawData) ? rawData : [];
            setOrders(dataArray);
            setFilteredOrders(dataArray);
        } catch (error) {
            toast.error("Failed to load Custom Photo Orders");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    useEffect(() => {
        if (!searchTerm) {
            setFilteredOrders(orders);
        } else {
            const lowerSearch = searchTerm.toLowerCase();
            const filtered = orders.filter(order => 
                (order._id && order._id.toLowerCase().includes(lowerSearch)) ||
                (order.customer?.name && order.customer.name.toLowerCase().includes(lowerSearch)) ||
                (order.seller?.shopName && order.seller.shopName.toLowerCase().includes(lowerSearch)) ||
                (order.city && order.city.toLowerCase().includes(lowerSearch))
            );
            setFilteredOrders(filtered);
        }
    }, [searchTerm, orders]);

    const getStatusBadge = (status) => {
        switch (status) {
            case "Completed":
                return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle size={14} /> {status}</span>;
            case "Accepted":
                return <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle size={14} /> {status}</span>;
            case "Rejected":
                return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><XCircle size={14} /> {status}</span>;
            default:
                return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><Clock size={14} /> {status}</span>;
        }
    };

    const formatOrderDate = (dateStr) => {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' }).format(d);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Custom Photo Orders</h1>
                    <p className="text-sm text-slate-500 font-medium">Monitor customer requests and seller chats in real-time.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search orders..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                        />
                    </div>
                    <button 
                        onClick={fetchOrders}
                        className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-brand-600 transition-colors"
                        title="Refresh Orders"
                    >
                        <RefreshCw size={18} className={isLoading ? "animate-spin text-brand-600" : ""} />
                    </button>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Order Details</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Seller</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500 font-medium">
                                        <div className="flex justify-center mb-3"><RefreshCw className="animate-spin text-brand-500" size={24} /></div>
                                        Loading photo orders...
                                    </td>
                                </tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500 font-medium">
                                        <div className="flex justify-center mb-3"><ImageIcon className="text-slate-300" size={32} /></div>
                                        No custom photo orders found.
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order) => (
                                    <tr key={order._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900 uppercase tracking-wide">#{order._id.slice(-6)}</div>
                                            <div className="text-xs text-slate-500 mt-1">{formatOrderDate(order.createdAt)}</div>
                                            <div className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1">
                                                {order.city}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                                    <User size={14} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800">{order.customer?.name || "Unknown"}</div>
                                                    <div className="text-xs text-slate-500">{order.customer?.phone}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                                                    <Store size={14} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800">{order.seller?.shopName || order.seller?.name || "Unknown"}</div>
                                                    <div className="text-xs text-slate-500 truncate max-w-[150px]">{order.seller?.city || "No City"}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(order.status)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => {
                                                    setSelectedOrder(order);
                                                    setIsChatModalOpen(true);
                                                }}
                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-colors border border-indigo-200"
                                            >
                                                <MessageSquare size={14} /> View Chat
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AdminPhotoOrderChatModal 
                isOpen={isChatModalOpen}
                onClose={() => {
                    setIsChatModalOpen(false);
                    setSelectedOrder(null);
                }}
                orderId={selectedOrder?._id}
                orderDetails={selectedOrder}
            />
        </div>
    );
};

export default AdminPhotoOrders;
