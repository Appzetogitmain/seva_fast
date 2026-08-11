import React, { useState, useEffect } from "react";
import {
    Sparkles,
    Plus,
    Pencil,
    Trash2,
    CheckCircle2,
    XCircle,
    Play,
    Pause,
    CheckSquare,
    Megaphone,
    Clock,
    Search,
    Loader2,
    DollarSign,
    Store,
    User,
    ChevronDown,
    AlertCircle,
    Eye,
    Shield,
} from "lucide-react";
import { adminApi } from "../services/adminApi";
import { toast } from "sonner";

const StorePromotions = () => {
    const [activeTab, setActiveTab] = useState("purchases"); // 'purchases' | 'plans'
    const [plans, setPlans] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal state for creating/editing plans
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [planForm, setPlanForm] = useState({
        name: "",
        amount: "",
        durationDays: "7",
        benefitsText: "",
        badgeText: "",
        displayColor: "#6366f1",
        description: "",
        sortOrder: "0",
        isActive: true,
    });
    const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);

    // Search and filter for purchases
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [updatingId, setUpdatingId] = useState(null);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [plansRes, purchasesRes] = await Promise.all([
                adminApi.getAdminStorePromotionPlans(),
                adminApi.getAdminStorePromotionPurchases(),
            ]);

            if (plansRes.data?.success) {
                setPlans(plansRes.data.results || plansRes.data.result || []);
            }
            if (purchasesRes.data?.success) {
                setPurchases(purchasesRes.data.results || purchasesRes.data.result || []);
            }
        } catch (error) {
            console.error("Failed to load promotion data", error);
            toast.error("Failed to load store promotions data");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openPlanModal = (plan = null) => {
        if (plan) {
            setEditingPlan(plan);
            setPlanForm({
                name: plan.name || "",
                amount: plan.amount !== undefined ? String(plan.amount) : "",
                durationDays: plan.durationDays ? String(plan.durationDays) : "7",
                benefitsText: Array.isArray(plan.benefits) ? plan.benefits.join("\n") : "",
                badgeText: plan.badgeText || "",
                displayColor: plan.displayColor || "#6366f1",
                description: plan.description || "",
                sortOrder: plan.sortOrder ? String(plan.sortOrder) : "0",
                isActive: plan.isActive !== undefined ? plan.isActive : true,
            });
        } else {
            setEditingPlan(null);
            setPlanForm({
                name: "",
                amount: "",
                durationDays: "7",
                benefitsText: "Featured Placement on Home Page\nTop Category Search Ranking\nIncreased Customer Reach",
                badgeText: "",
                displayColor: "#6366f1",
                description: "",
                sortOrder: "0",
                isActive: true,
            });
        }
        setIsPlanModalOpen(true);
    };

    const handleSavePlan = async (e) => {
        e.preventDefault();
        if (!planForm.name.trim() || planForm.amount === "" || !planForm.durationDays) {
            toast.error("Name, Amount, and Duration Days are required");
            return;
        }

        try {
            setIsSubmittingPlan(true);
            const benefits = planForm.benefitsText
                .split("\n")
                .map((b) => b.trim())
                .filter(Boolean);

            const payload = {
                name: planForm.name.trim(),
                amount: Number(planForm.amount),
                durationDays: Number(planForm.durationDays),
                benefits,
                badgeText: planForm.badgeText.trim(),
                displayColor: planForm.displayColor,
                description: planForm.description.trim(),
                sortOrder: Number(planForm.sortOrder) || 0,
                isActive: planForm.isActive,
            };

            if (editingPlan) {
                await adminApi.updateStorePromotionPlan(editingPlan._id, payload);
                toast.success("Store promotion plan updated successfully");
            } else {
                await adminApi.createStorePromotionPlan(payload);
                toast.success("Store promotion plan created successfully");
            }

            setIsPlanModalOpen(false);
            fetchData();
        } catch (error) {
            console.error("Save plan error", error);
            toast.error(error.response?.data?.message || "Failed to save plan");
        } finally {
            setIsSubmittingPlan(false);
        }
    };

    const handleDeletePlan = async (planId) => {
        if (!window.confirm("Are you sure you want to delete this promotion plan?")) return;
        try {
            await adminApi.deleteStorePromotionPlan(planId);
            toast.success("Store promotion plan deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete promotion plan");
        }
    };

    const handleStatusChange = async (purchaseId, campaignStatus) => {
        try {
            setUpdatingId(purchaseId);
            const res = await adminApi.updateStorePromotionCampaignStatus(purchaseId, { campaignStatus });
            if (res.data?.success) {
                toast.success(`Campaign status updated to "${campaignStatus}"`);
                fetchData();
            } else {
                toast.error("Failed to update status");
            }
        } catch (error) {
            console.error("Update campaign status error", error);
            toast.error(error.response?.data?.message || "Failed to update campaign status");
        } finally {
            setUpdatingId(null);
        }
    };

    const filteredPurchases = purchases.filter((item) => {
        const sellerName = item.seller?.name || "";
        const shopName = item.seller?.shopName || "";
        const planName = item.planName || item.plan?.name || "";

        const matchesSearch =
            sellerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            shopName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            planName.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === "all" || item.campaignStatus === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const getCampaignBadgeClass = (status) => {
        switch (status) {
            case "Active":
                return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
            case "Pending Activation":
                return "bg-amber-500/10 text-amber-600 border-amber-500/30 font-bold";
            case "Paused":
                return "bg-blue-500/10 text-blue-600 border-blue-500/30";
            case "Completed":
                return "bg-slate-500/10 text-slate-600 border-slate-500/30";
            case "Cancelled":
                return "bg-rose-500/10 text-rose-600 border-rose-500/30";
            default:
                return "bg-slate-100 text-slate-600 border-slate-200";
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 font-['Outfit'] pb-24 space-y-8">
            {/* Top Page Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="relative z-10">
                    <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase tracking-[2px] rounded-full inline-block mb-3">
                        Marketing &amp; Seller Visibility
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                        🚀 Store Promotions &amp; Ads
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
                        Manage promotion plans and monitor seller marketing campaigns.
                    </p>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    <button
                        onClick={() => openPlanModal()}
                        className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                        <Plus className="h-4 w-4" /> Create Promotion Plan
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 gap-4">
                <button
                    onClick={() => setActiveTab("purchases")}
                    className={`pb-3 px-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                        activeTab === "purchases"
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-slate-400 hover:text-slate-700"
                    }`}
                >
                    Purchased Promotions ({purchases.length})
                </button>
                <button
                    onClick={() => setActiveTab("plans")}
                    className={`pb-3 px-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                        activeTab === "plans"
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-slate-400 hover:text-slate-700"
                    }`}
                >
                    Promotion Plans ({plans.length})
                </button>
            </div>

            {/* Loading Spinner */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Store Promotions...</p>
                </div>
            ) : activeTab === "purchases" ? (
                /* TAB 1: PURCHASED PROMOTIONS / CAMPAIGNS */
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-6">
                    {/* Filter Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by Seller, Shop, or Plan..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Campaign Status:</span>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
                            >
                                <option value="all">All Statuses</option>
                                <option value="Pending Activation">Pending Activation</option>
                                <option value="Active">Active</option>
                                <option value="Paused">Paused</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    {/* Purchases Table */}
                    {filteredPurchases.length === 0 ? (
                        <div className="py-16 text-center text-slate-400">
                            <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-bold text-slate-600">No promotion purchases found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="py-3 px-4">Seller &amp; Store</th>
                                        <th className="py-3 px-4">Promotion Plan</th>
                                        <th className="py-3 px-4">Amount</th>
                                        <th className="py-3 px-4">Payment Status</th>
                                        <th className="py-3 px-4">Campaign Status</th>
                                        <th className="py-3 px-4">Dates</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                    {filteredPurchases.map((item) => {
                                        const sellerName = item.seller?.name || "N/A";
                                        const shopName = item.seller?.shopName || "N/A";
                                        const phone = item.seller?.phone || "";

                                        return (
                                            <tr key={item._id} className="hover:bg-slate-50/80 transition-colors">
                                                {/* Seller Details */}
                                                <td className="py-4 px-4">
                                                    <div className="font-black text-slate-900">{sellerName}</div>
                                                    <div className="text-[11px] font-bold text-indigo-600 flex items-center gap-1 mt-0.5">
                                                        <Store className="h-3.5 w-3.5 shrink-0" />
                                                        <span>{shopName}</span>
                                                    </div>
                                                    {phone && <div className="text-[10px] text-slate-400">{phone}</div>}
                                                </td>

                                                {/* Plan Details */}
                                                <td className="py-4 px-4 font-black text-slate-800">
                                                    {item.planName || item.plan?.name || "Promotion Plan"}
                                                    <div className="text-[10px] text-slate-400 font-normal">
                                                        {item.durationDays} Days Duration
                                                    </div>
                                                </td>

                                                {/* Amount */}
                                                <td className="py-4 px-4 font-mono font-black text-slate-900">
                                                    ₹{item.amount}
                                                </td>

                                                {/* Payment Status */}
                                                <td className="py-4 px-4">
                                                    <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full border ${item.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                        {item.paymentStatus}
                                                    </span>
                                                </td>

                                                {/* Campaign Status */}
                                                <td className="py-4 px-4">
                                                    <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full border ${getCampaignBadgeClass(item.campaignStatus)}`}>
                                                        {item.campaignStatus}
                                                    </span>
                                                </td>

                                                {/* Dates */}
                                                <td className="py-4 px-4 font-mono text-[11px] text-slate-500">
                                                    <div>Paid: {item.paidAt ? new Date(item.paidAt).toLocaleDateString('en-IN', { dateStyle: 'short' }) : 'N/A'}</div>
                                                    {item.activatedAt && <div className="text-emerald-600">Active: {new Date(item.activatedAt).toLocaleDateString('en-IN', { dateStyle: 'short' })}</div>}
                                                    {item.expiresAt && <div className="text-slate-400">Expires: {new Date(item.expiresAt).toLocaleDateString('en-IN', { dateStyle: 'short' })}</div>}
                                                </td>

                                                {/* Action Buttons */}
                                                <td className="py-4 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                        {item.campaignStatus !== "Active" && (
                                                            <button
                                                                onClick={() => handleStatusChange(item._id, "Active")}
                                                                disabled={updatingId === item._id}
                                                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1"
                                                            >
                                                                <Play className="h-3 w-3" /> Activate
                                                            </button>
                                                        )}
                                                        {item.campaignStatus === "Active" && (
                                                            <button
                                                                onClick={() => handleStatusChange(item._id, "Paused")}
                                                                disabled={updatingId === item._id}
                                                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1"
                                                            >
                                                                <Pause className="h-3 w-3" /> Pause
                                                            </button>
                                                        )}
                                                        {item.campaignStatus !== "Completed" && (
                                                            <button
                                                                onClick={() => handleStatusChange(item._id, "Completed")}
                                                                disabled={updatingId === item._id}
                                                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1"
                                                            >
                                                                <CheckSquare className="h-3 w-3" /> Complete
                                                            </button>
                                                        )}
                                                        {item.campaignStatus !== "Cancelled" && (
                                                            <button
                                                                onClick={() => handleStatusChange(item._id, "Cancelled")}
                                                                disabled={updatingId === item._id}
                                                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-wider rounded-lg border border-rose-200 transition-all flex items-center gap-1"
                                                            >
                                                                <XCircle className="h-3 w-3" /> Cancel
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                /* TAB 2: PROMOTION PLANS MANAGEMENT */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {plans.map((plan) => (
                        <div
                            key={plan._id}
                            className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden"
                            style={{ borderTop: `6px solid ${plan.displayColor || '#6366f1'}` }}
                        >
                            <div>
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <h3 className="text-xl font-black text-slate-900">{plan.name}</h3>
                                    <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase rounded-full border ${plan.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                        {plan.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>

                                <div className="text-2xl font-black text-slate-900 font-mono my-2">
                                    ₹{plan.amount} <span className="text-xs text-slate-400 font-normal">/ {plan.durationDays} Days</span>
                                </div>

                                {plan.description && (
                                    <p className="text-xs text-slate-500 font-medium mb-4 leading-relaxed">{plan.description}</p>
                                )}

                                <div className="space-y-2 mb-6">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Benefits:</span>
                                    {(plan.benefits || []).map((b, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                            <span>{b}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                <button
                                    onClick={() => openPlanModal(plan)}
                                    className="px-3 py-2 text-xs font-black uppercase tracking-wider text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all flex items-center gap-1.5"
                                >
                                    <Pencil className="h-3.5 w-3.5" /> Edit
                                </button>
                                <button
                                    onClick={() => handleDeletePlan(plan._id)}
                                    className="px-3 py-2 text-xs font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 rounded-xl transition-all flex items-center gap-1.5"
                                >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* CREATE / EDIT PLAN MODAL */}
            {isPlanModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <h3 className="text-lg font-black text-slate-900">
                                {editingPlan ? "Edit Store Promotion Plan" : "Create Store Promotion Plan"}
                            </h3>
                            <button
                                onClick={() => setIsPlanModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSavePlan} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                    Plan Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Silver Boost, Featured Spotlight"
                                    value={planForm.name}
                                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                        Amount (₹) * (Set by Admin)
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        placeholder="e.g. 499"
                                        value={planForm.amount}
                                        onChange={(e) => setPlanForm({ ...planForm, amount: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                        Duration (Days) *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        placeholder="e.g. 7"
                                        value={planForm.durationDays}
                                        onChange={(e) => setPlanForm({ ...planForm, durationDays: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                    Benefits (One per line)
                                </label>
                                <textarea
                                    rows="4"
                                    placeholder="Featured Banner Placement&#10;Top Category Search Result&#10;5x Customer Reach"
                                    value={planForm.benefitsText}
                                    onChange={(e) => setPlanForm({ ...planForm, benefitsText: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                        Badge Text (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Popular, Hot"
                                        value={planForm.badgeText}
                                        onChange={(e) => setPlanForm({ ...planForm, badgeText: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                        Theme Color
                                    </label>
                                    <input
                                        type="color"
                                        value={planForm.displayColor}
                                        onChange={(e) => setPlanForm({ ...planForm, displayColor: e.target.value })}
                                        className="w-full h-10 p-1 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                                    Description (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Brief plan tagline"
                                    value={planForm.description}
                                    onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={planForm.isActive}
                                        onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                    />
                                    Active for Seller Purchase
                                </label>
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsPlanModalOpen(false)}
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingPlan}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
                                >
                                    {isSubmittingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Plan"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StorePromotions;
