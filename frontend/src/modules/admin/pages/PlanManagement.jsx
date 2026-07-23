import React, { useState, useEffect } from 'react';
import { Plus, LayoutGrid, Search, Filter, Loader2, Sparkles } from 'lucide-react';
import { planApi } from '../services/planApi';
import PlanCard from '@shared/components/ui/PlanCard';
import PlanEditorModal from '../components/PlanEditorModal';
import { useToast } from '@shared/components/ui/Toast';

const PlanManagement = () => {
    const { showToast } = useToast();
    const [plans, setPlans] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive
    const [viewMode, setViewMode] = useState('grid'); // grid, list

    const fetchPlans = async () => {
        try {
            setIsLoading(true);
            const res = await planApi.getPlans();
            if (res.data?.success) {
                setPlans(res.data.results || res.data.result || []);
            }
        } catch (error) {
            console.error("Failed to fetch plans", error);
            showToast('Failed to load plans', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);

    const handleCreate = () => {
        setSelectedPlan(null);
        setIsModalOpen(true);
    };

    const handleEdit = (plan) => {
        setSelectedPlan(plan);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this plan?')) return;
        try {
            await planApi.deletePlan(id);
            showToast('Plan deleted successfully', 'success');
            fetchPlans();
        } catch (error) {
            showToast('Failed to delete plan', 'error');
        }
    };

    const handleSave = async (data) => {
        try {
            if (selectedPlan) {
                await planApi.updatePlan(selectedPlan._id, data);
                showToast('Plan updated successfully', 'success');
            } else {
                await planApi.createPlan(data);
                showToast('Plan created successfully', 'success');
            }
            setIsModalOpen(false);
            fetchPlans();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to save plan', 'error');
        }
    };

    const filteredPlans = plans.filter(p => {
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
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Subscription Plans
                        <div className="p-2 bg-brand-50 rounded-xl">
                            <Sparkles className="h-5 w-5 text-brand-600" />
                        </div>
                    </h1>
                    <p className="ds-description mt-1">Manage dynamic yearly recharge plans and user permissions.</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-3 px-8 py-4 bg-black text-white rounded-[24px] text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-100 hover:scale-[1.02] active:scale-95"
                >
                    <Plus className="h-5 w-5" />
                    Create New Plan
                </button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-[32px] shadow-sm border border-slate-50">
                <div className="relative flex-1 group w-full">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search plans by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-[20px] text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
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

            {/* Plans Grid */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <Loader2 className="h-12 w-12 text-brand-500 animate-spin" />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading Plans...</p>
                </div>
            ) : filteredPlans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-6 bg-white rounded-[40px] border-2 border-dashed border-slate-100">
                    <div className="p-6 bg-slate-50 rounded-full">
                        <Sparkles className="h-10 w-10 text-slate-300" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-black text-slate-900">No Plans Found</h3>
                        <p className="text-sm font-bold text-slate-400 mt-2 max-w-xs mx-auto">
                            {searchQuery ? `No results for "${searchQuery}". Try a different term.` : "You haven't created any subscription plans yet."}
                        </p>
                    </div>
                    {!searchQuery && (
                        <button
                            onClick={handleCreate}
                            className="px-8 py-4 bg-brand-50 text-brand-600 rounded-[24px] text-xs font-black uppercase tracking-widest hover:bg-brand-100 transition-all"
                        >
                            Create Your First Plan
                        </button>
                    )}
                </div>
            ) : (
                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" : "flex flex-col gap-6"}>
                    {filteredPlans.map((plan) => (
                        <PlanCard 
                            key={plan._id} 
                            plan={plan} 
                            isAdmin={true} 
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            <PlanEditorModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                plan={selectedPlan}
            />
        </div>
    );
};

export default PlanManagement;
