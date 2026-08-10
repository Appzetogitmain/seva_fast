import React, { useState, useEffect } from 'react';
import { Plus, LayoutGrid, Search, Filter, Loader2, Sparkles, Store, Users, Clock, CheckCircle2, Trash2, Edit2 } from 'lucide-react';
import { planApi } from '../services/planApi';
import { adminApi } from '../services/adminApi';
import PlanCard from '@shared/components/ui/PlanCard';
import PlanEditorModal from '../components/PlanEditorModal';
import SellerPlanEditorModal from '../components/SellerPlanEditorModal';
import { useToast } from '@shared/components/ui/Toast';

const PlanManagement = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('seller'); // 'seller' | 'customer'
    
    // Customer Plans State
    const [customerPlans, setCustomerPlans] = useState([]);
    const [isCustomerLoading, setIsCustomerLoading] = useState(true);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [selectedCustomerPlan, setSelectedCustomerPlan] = useState(null);

    // Seller Plans State
    const [sellerPlans, setSellerPlans] = useState([]);
    const [isSellerLoading, setIsSellerLoading] = useState(true);
    const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
    const [selectedSellerPlan, setSelectedSellerPlan] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive
    const [viewMode, setViewMode] = useState('grid'); // grid, list

    const fetchCustomerPlans = async () => {
        try {
            setIsCustomerLoading(true);
            const res = await planApi.getPlans();
            if (res.data?.success) {
                setCustomerPlans(res.data.results || res.data.result || []);
            }
        } catch (error) {
            console.error("Failed to fetch customer plans", error);
            showToast('Failed to load customer plans', 'error');
        } finally {
            setIsCustomerLoading(false);
        }
    };

    const fetchSellerPlans = async () => {
        try {
            setIsSellerLoading(true);
            const res = await adminApi.getSellerPlans();
            if (res.data?.success) {
                setSellerPlans(res.data.results || res.data.result || []);
            }
        } catch (error) {
            console.error("Failed to fetch seller plans", error);
            showToast('Failed to load seller plans', 'error');
        } finally {
            setIsSellerLoading(false);
        }
    };

    useEffect(() => {
        fetchSellerPlans();
        fetchCustomerPlans();
    }, []);

    // Customer Plan Handlers
    const handleCreateCustomer = () => {
        setSelectedCustomerPlan(null);
        setIsCustomerModalOpen(true);
    };

    const handleEditCustomer = (plan) => {
        setSelectedCustomerPlan(plan);
        setIsCustomerModalOpen(true);
    };

    const handleDeleteCustomer = async (id) => {
        if (!window.confirm('Are you sure you want to delete this customer plan?')) return;
        try {
            await planApi.deletePlan(id);
            showToast('Plan deleted successfully', 'success');
            fetchCustomerPlans();
        } catch (error) {
            showToast('Failed to delete plan', 'error');
        }
    };

    const handleSaveCustomer = async (data) => {
        try {
            if (selectedCustomerPlan) {
                await planApi.updatePlan(selectedCustomerPlan._id, data);
                showToast('Customer plan updated successfully', 'success');
            } else {
                await planApi.createPlan(data);
                showToast('Customer plan created successfully', 'success');
            }
            setIsCustomerModalOpen(false);
            fetchCustomerPlans();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to save customer plan', 'error');
        }
    };

    // Seller Plan Handlers
    const handleCreateSeller = () => {
        setSelectedSellerPlan(null);
        setIsSellerModalOpen(true);
    };

    const handleEditSeller = (plan) => {
        setSelectedSellerPlan(plan);
        setIsSellerModalOpen(true);
    };

    const handleDeleteSeller = async (id) => {
        if (!window.confirm('Are you sure you want to delete this seller plan?')) return;
        try {
            await adminApi.deleteSellerPlan(id);
            showToast('Seller plan deleted successfully', 'success');
            fetchSellerPlans();
        } catch (error) {
            showToast('Failed to delete seller plan', 'error');
        }
    };

    const handleSaveSeller = async (data) => {
        try {
            if (selectedSellerPlan) {
                await adminApi.updateSellerPlan(selectedSellerPlan._id, data);
                showToast('Seller plan updated successfully', 'success');
            } else {
                await adminApi.createSellerPlan(data);
                showToast('Seller plan created successfully', 'success');
            }
            setIsSellerModalOpen(false);
            fetchSellerPlans();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to save seller plan', 'error');
        }
    };

    const currentPlans = activeTab === 'seller' ? sellerPlans : customerPlans;
    const isLoading = activeTab === 'seller' ? isSellerLoading : isCustomerLoading;

    const filteredPlans = currentPlans.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' ? true : (statusFilter === 'active' ? p.isActive : !p.isActive);
        return matchesSearch && matchesStatus;
    });

    const toggleFilter = () => {
        setStatusFilter(prev => prev === 'all' ? 'active' : prev === 'active' ? 'inactive' : 'all');
    };

    const toggleViewMode = () => {
        setViewMode(prev => prev === 'grid' ? 'list' : 'grid');
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 font-['Outfit']">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Subscription Plans
                        <div className="p-2 bg-slate-100 rounded-xl">
                            <Sparkles className="h-5 w-5 text-slate-900" />
                        </div>
                    </h1>
                    <p className="ds-description mt-1">Manage dynamic plans for Sellers (0% Commission Passes) and Customers.</p>
                </div>
                <button
                    onClick={activeTab === 'seller' ? handleCreateSeller : handleCreateCustomer}
                    className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-[24px] text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-95"
                >
                    <Plus className="h-5 w-5" />
                    {activeTab === 'seller' ? 'Create Seller Plan' : 'Create Customer Plan'}
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex bg-white p-2 rounded-[24px] border border-slate-200 shadow-sm w-full md:w-fit gap-2">
                <button
                    onClick={() => setActiveTab('seller')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-[18px] text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'seller'
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'text-slate-500 hover:bg-slate-100'
                    }`}
                >
                    <Store className="h-4 w-4" />
                    Seller Subscription Plans ({sellerPlans.length})
                </button>
                <button
                    onClick={() => setActiveTab('customer')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-[18px] text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'customer'
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'text-slate-500 hover:bg-slate-100'
                    }`}
                >
                    <Users className="h-4 w-4" />
                    Customer Membership Plans ({customerPlans.length})
                </button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-[32px] shadow-sm border border-slate-100">
                <div className="relative flex-1 group w-full">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                    <input
                        type="text"
                        placeholder={`Search ${activeTab} plans by name...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-[20px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button 
                        onClick={toggleFilter}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded-[20px] text-xs font-black uppercase tracking-widest transition-all ${
                            statusFilter !== 'all' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <Filter className="h-4 w-4" />
                        {statusFilter === 'all' ? 'Filter' : statusFilter}
                    </button>
                    <button 
                        onClick={toggleViewMode}
                        className="p-4 bg-slate-50 text-slate-600 rounded-[20px] hover:bg-slate-100 transition-all"
                    >
                        <LayoutGrid className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Plans List / Grid */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <Loader2 className="h-12 w-12 text-slate-900 animate-spin" />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading Plans...</p>
                </div>
            ) : filteredPlans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-6 bg-white rounded-[40px] border-2 border-dashed border-slate-100">
                    <div className="p-6 bg-slate-50 rounded-full">
                        <Sparkles className="h-10 w-10 text-slate-300" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-black text-slate-900">No {activeTab === 'seller' ? 'Seller' : 'Customer'} Plans Found</h3>
                        <p className="text-sm font-bold text-slate-400 mt-2 max-w-xs mx-auto">
                            {searchQuery ? `No results for "${searchQuery}". Try a different term.` : `You haven't created any ${activeTab} subscription plans yet.`}
                        </p>
                    </div>
                    {!searchQuery && (
                        <button
                            onClick={activeTab === 'seller' ? handleCreateSeller : handleCreateCustomer}
                            className="px-8 py-4 bg-slate-900 text-white rounded-[24px] text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                        >
                            Create First {activeTab === 'seller' ? 'Seller' : 'Customer'} Plan
                        </button>
                    )}
                </div>
            ) : activeTab === 'seller' ? (
                /* SELLER PLANS DISPLAY */
                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" : "flex flex-col gap-6"}>
                    {filteredPlans.map((plan) => (
                        <div
                            key={plan._id}
                            className="relative flex flex-col bg-white rounded-[32px] p-6 border border-slate-200 shadow-xl shadow-slate-100/50 hover:shadow-2xl transition-all duration-300 overflow-hidden"
                            style={{ borderTop: `6px solid ${plan.displayColor || '#0ea5e9'}` }}
                        >
                            {/* Header & Badges */}
                            <div className="flex items-center justify-between gap-2 mb-4">
                                <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                                    plan.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                                }`}>
                                    {plan.isActive ? 'Active' : 'Inactive'}
                                </span>
                                {plan.badgeText && (
                                    <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-amber-500 text-white rounded-full shadow-sm">
                                        {plan.badgeText}
                                    </span>
                                )}
                            </div>

                            {/* Title & Validity */}
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">{plan.name}</h3>
                            <div className="flex items-center gap-2 mt-1 text-slate-500 text-xs font-bold">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                {plan.validityDays} Days Pass ({Math.round(plan.validityDays / 30)} Months)
                            </div>

                            {/* Price */}
                            <div className="my-6 flex items-baseline gap-2">
                                <span className="text-4xl font-black text-slate-900">₹{plan.price}</span>
                                {plan.originalPrice && (
                                    <span className="text-sm font-bold text-slate-400 line-through">₹{plan.originalPrice}</span>
                                )}
                                <span className="text-xs font-bold text-slate-400">/ {plan.validityDays} Days</span>
                            </div>

                            {/* Description */}
                            {plan.description && (
                                <p className="text-xs text-slate-500 font-medium mb-6 line-clamp-2">{plan.description}</p>
                            )}

                            {/* 0% Commission Hero Badge */}
                            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3 mb-6">
                                <div className="p-2 bg-emerald-500 text-white rounded-xl">
                                    <CheckCircle2 className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-emerald-900 uppercase tracking-wide">0% Commission</p>
                                    <p className="text-[10px] text-emerald-700 font-medium">100% order payout to seller</p>
                                </div>
                            </div>

                            {/* Features */}
                            <div className="flex-1 space-y-2 mb-8">
                                {Array.isArray(plan.features) && plan.features.map((ft, idx) => (
                                    <div key={idx} className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                        <span>{ft}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-4 border-t border-slate-100 mt-auto">
                                <button
                                    onClick={() => handleEditSeller(plan)}
                                    className="flex-1 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                                >
                                    <Edit2 className="h-3.5 w-3.5" /> Edit
                                </button>
                                <button
                                    onClick={() => handleDeleteSeller(plan._id)}
                                    className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-all"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* CUSTOMER PLANS DISPLAY */
                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" : "flex flex-col gap-6"}>
                    {filteredPlans.map((plan) => (
                        <PlanCard 
                            key={plan._id} 
                            plan={plan} 
                            isAdmin={true} 
                            onEdit={handleEditCustomer}
                            onDelete={handleDeleteCustomer}
                        />
                    ))}
                </div>
            )}

            <PlanEditorModal
                isOpen={isCustomerModalOpen}
                onClose={() => setIsCustomerModalOpen(false)}
                onSave={handleSaveCustomer}
                plan={selectedCustomerPlan}
            />

            <SellerPlanEditorModal
                isOpen={isSellerModalOpen}
                onClose={() => setIsSellerModalOpen(false)}
                onSave={handleSaveSeller}
                plan={selectedSellerPlan}
            />
        </div>
    );
};

export default PlanManagement;
