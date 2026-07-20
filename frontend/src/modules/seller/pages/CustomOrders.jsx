import React, { useState, useEffect } from "react";
import axiosInstance from "@core/api/axios";
import { toast } from "sonner";
import { HiOutlinePhotograph, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineClock } from "react-icons/hi";
import { formatDate } from "@shared/utils/formatDate";

const CustomOrders = () => {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchOrders = async () => {
        try {
            setIsLoading(true);
            const res = await axiosInstance.get("/seller-photo-orders");
            setOrders(res.data.result || res.data.results || []);
        } catch (error) {
            toast.error("Failed to fetch custom orders");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const updateStatus = async (id, status) => {
        try {
            await axiosInstance.put(`/seller-photo-orders/${id}/status`, { status });
            toast.success(`Order marked as ${status}`);
            fetchOrders();
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Accepted': return <HiOutlineCheckCircle className="text-green-500" size={20} />;
            case 'Rejected': return <HiOutlineXCircle className="text-red-500" size={20} />;
            case 'Completed': return <HiOutlineCheckCircle className="text-blue-500" size={20} />;
            default: return <HiOutlineClock className="text-orange-500" size={20} />;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="sm:flex sm:items-center sm:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <HiOutlinePhotograph className="text-indigo-600" />
                        Custom Photo Orders
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Manage direct picture orders from customers.
                    </p>
                </div>
            </div>

            {orders.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow border border-gray-200">
                    <HiOutlinePhotograph className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No Custom Orders</h3>
                    <p className="mt-1 text-sm text-gray-500">You haven't received any photo orders yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {orders.map(order => (
                        <div key={order._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                            <div className="h-48 w-full bg-gray-100 border-b border-gray-200 relative group">
                                <img 
                                    src={order.photoUrl} 
                                    alt="Order Request" 
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <a href={order.photoUrl} target="_blank" rel="noreferrer" className="px-4 py-2 bg-white rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-50">
                                        View Full Image
                                    </a>
                                </div>
                            </div>
                            
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{order.customer?.name || 'Customer'}</h3>
                                        <p className="text-xs text-gray-500">{order.customer?.phone || 'No Phone'}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200">
                                        {getStatusIcon(order.status)}
                                        <span className="text-xs font-medium text-gray-700">{order.status}</span>
                                    </div>
                                </div>

                                {order.notes && (
                                    <div className="mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
                                    </div>
                                )}
                                
                                <p className="text-xs text-gray-400 mb-4 text-right">
                                    Received: {formatDate(order.createdAt)}
                                </p>

                                <div className="grid grid-cols-2 gap-2">
                                    {order.status === 'Pending' && (
                                        <>
                                            <button 
                                                onClick={() => updateStatus(order._id, 'Accepted')}
                                                className="w-full py-2 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium rounded-lg border border-green-200 transition-colors"
                                            >
                                                Accept
                                            </button>
                                            <button 
                                                onClick={() => updateStatus(order._id, 'Rejected')}
                                                className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium rounded-lg border border-red-200 transition-colors"
                                            >
                                                Reject
                                            </button>
                                        </>
                                    )}
                                    
                                    {order.status === 'Accepted' && (
                                        <button 
                                            onClick={() => updateStatus(order._id, 'Completed')}
                                            className="col-span-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                        >
                                            Mark as Completed
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CustomOrders;
