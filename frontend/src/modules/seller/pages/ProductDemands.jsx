import React, { useEffect, useState } from 'react';
import { sellerApi } from '../services/sellerApi';
import { Loader2, Bell, MapPin, Package, ArrowRight } from 'lucide-react';
import { useToast } from '@shared/components/ui/Toast';
import { Link } from 'react-router-dom';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

const ProductDemands = () => {
    const [demands, setDemands] = useState([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
        fetchDemands();
    }, []);

    const fetchDemands = async () => {
        try {
            setLoading(true);
            const res = await sellerApi.getProductDemands();
            if (res.data?.success) {
                setDemands(res.data.demands || []);
            }
        } catch (error) {
            console.error("Failed to fetch demands:", error);
            showToast("Failed to load product demands", "error");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <Bell className="text-primary" size={28} />
                        Customer Demands
                    </h1>
                    <p className="text-gray-500 font-medium text-sm mt-1">
                        Products that are currently out of stock but have high customer demand.
                    </p>
                </div>
            </div>

            {demands.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <Package className="text-gray-400" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">No Pending Demands</h3>
                    <p className="text-gray-500 text-sm max-w-md mx-auto mt-2">
                        You're all caught up! There are currently no customer requests for out-of-stock items.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {demands.map((demand, index) => (
                        <div key={index} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-all group">
                            <div className="flex gap-4 items-start">
                                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0">
                                    <img 
                                        src={applyCloudinaryTransform(demand.productImage, "f_auto,q_auto,w_150")} 
                                        alt={demand.productName} 
                                        className="w-full h-full object-contain mix-blend-multiply"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = 'https://via.placeholder.com/150';
                                        }}
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-gray-900 text-base leading-tight line-clamp-2" title={demand.productName}>
                                        {demand.productName}
                                    </h3>
                                    {demand.variantSku && (
                                        <span className="inline-block mt-1 bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                                            {demand.variantSku}
                                        </span>
                                    )}
                                    <div className="mt-3 flex items-center gap-1.5 bg-orange-50 text-orange-600 w-fit px-2.5 py-1 rounded-lg border border-orange-100">
                                        <Bell size={14} className="fill-orange-500 text-orange-500" />
                                        <span className="text-xs font-black">{demand.demandCount} Requests</span>
                                    </div>
                                </div>
                            </div>
                            
                            {demand.topLocations && demand.topLocations.length > 0 && (
                                <div className="mt-5 bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        <MapPin size={12} />
                                        Requested From
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {demand.topLocations.map((loc, i) => loc ? (
                                            <span key={i} className="bg-white text-slate-700 border border-slate-200 text-[11px] font-medium px-2 py-1 rounded-md shadow-sm line-clamp-1 max-w-[120px]" title={loc}>
                                                {loc}
                                            </span>
                                        ) : null)}
                                    </div>
                                </div>
                            )}
                            
                            <div className="mt-auto pt-5">
                                <Link
                                    to={`/seller/inventory?productId=${demand.productId}`}
                                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-[var(--brand-600)] text-white font-black text-sm py-2.5 rounded-xl transition-all shadow-sm active:scale-[0.98]"
                                >
                                    Update Stock
                                    <ArrowRight size={16} />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProductDemands;
