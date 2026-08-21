import React, { useState, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import PageHeader from '@shared/components/ui/PageHeader';
import {
    Users,
    Search,
    Loader2,
    Gift,
    Award,
    Clock,
    UserPlus,
    CheckCircle2,
    X,
    Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import { formatDate } from '@shared/utils/formatDate';
import MlmBannerManagerModal from '../components/MlmBannerManagerModal';

const getTreeStats = (tree) => {
    let total = 0;
    const stats = {};
    const traverse = (node) => {
        if (node.level > 0) {
            total++;
            stats[node.level] = (stats[node.level] || 0) + 1;
        }
        if (node.children) {
            node.children.forEach(traverse);
        }
    };
    traverse(tree);
    return { total, levels: stats };
};

const ReferralNode = ({ node, isLast }) => {
    const [isOpen, setIsOpen] = React.useState(true);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className="relative pl-6 mt-2">
            {/* Visual connecting lines */}
            <div className={cn("absolute left-0 w-0.5 bg-slate-300", isLast ? "h-9 top-[-8px]" : "top-[-8px] bottom-0")}></div>
            <div className="absolute top-7 left-0 w-6 h-0.5 bg-slate-300"></div>

            <div className="bg-white rounded-xl p-3 border border-slate-200/50 shadow-sm flex items-center justify-between hover:border-indigo-200 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                        node.level === 1 ? "bg-emerald-100 text-emerald-700" :
                        node.level === 2 ? "bg-amber-100 text-amber-700" :
                        node.level === 3 ? "bg-rose-100 text-rose-700" :
                        "bg-blue-100 text-blue-700"
                    )}>
                        L{node.level}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-slate-800 truncate">{node.name}</h4>
                            {node.earnings > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                                    +₹{node.earnings.toFixed(2)}
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium truncate">Ref: {node.referralCode} • {node.phone}</p>
                    </div>
                </div>
                {hasChildren && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            setIsOpen(!isOpen);
                        }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
                    >
                        {isOpen ? "Hide" : `Show (${node.children.length})`}
                    </button>
                )}
            </div>

            {isOpen && hasChildren && (
                <div className="space-y-2 mt-2 ml-[28px] relative">
                    {node.children.map((child, idx) => (
                        <ReferralNode
                            key={child._id}
                            node={child}
                            isLast={idx === node.children.length - 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const ReferralTreeModal = ({ isOpen, onClose, customer }) => {
    const [treeData, setTreeData] = React.useState(null);
    const [earningsByLevel, setEarningsByLevel] = React.useState({});
    const [targetDetails, setTargetDetails] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        if (isOpen && customer) {
            fetchTreeData();
        }
    }, [isOpen, customer]);

    const fetchTreeData = async () => {
        try {
            setIsLoading(true);
            const res = await adminApi.getUserReferralTree(customer.id);
            setTreeData(res.data.result.tree);
            setEarningsByLevel(res.data.result.earningsByLevel || {});
            setTargetDetails(res.data.result.targetDetails || null);
        } catch (error) {
            toast.error("Failed to load referral tree");
        } finally {
            setIsLoading(false);
        }
    };

    const stats = React.useMemo(() => {
        if (!treeData) return { total: 0, levels: {} };
        return getTreeStats(treeData);
    }, [treeData]);

    const totalEarnings = React.useMemo(() => {
        return Object.values(earningsByLevel).reduce((sum, val) => sum + val, 0);
    }, [earningsByLevel]);

    const level1Earnings = earningsByLevel[1] || 0;

    const level2PlusEarnings = React.useMemo(() => {
        return Object.entries(earningsByLevel)
            .filter(([lvl]) => Number(lvl) >= 2)
            .reduce((sum, [_, val]) => sum + val, 0);
    }, [earningsByLevel]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-50 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl h-[85vh] relative animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-4 border-b border-slate-200/60 flex items-center justify-between bg-white">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Users size={20} className="text-amber-600" />
                        Referral Network: {customer.name}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-3">
                            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-semibold text-slate-500">Loading referral network...</span>
                        </div>
                    ) : treeData ? (
                        <>
                            {/* Stats Summary */}
                            <div className="grid grid-cols-3 gap-3 bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm text-center">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Referrals</p>
                                    <p className="text-xl font-extrabold text-amber-600">{stats.total}</p>
                                    <p className="text-[9px] font-black text-amber-500 mt-0.5">₹{totalEarnings.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Level 1</p>
                                    <p className="text-xl font-extrabold text-emerald-600">{stats.levels[1] || 0}</p>
                                    <p className="text-[9px] font-black text-emerald-500 mt-0.5">₹{level1Earnings.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Level 2+</p>
                                    <p className="text-xl font-extrabold text-indigo-600">
                                        {Object.entries(stats.levels)
                                            .filter(([lvl]) => Number(lvl) > 1)
                                            .reduce((sum, [, count]) => sum + count, 0)}
                                    </p>
                                    <p className="text-[9px] font-black text-indigo-500 mt-0.5">₹{level2PlusEarnings.toFixed(2)}</p>
                                </div>
                            </div>

                            {/* Monthly Target Progress Section */}
                            {targetDetails && targetDetails.monthlyTarget ? (
                                <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Sparkles size={16} className="text-amber-500 animate-pulse" />
                                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                                Monthly Target ({targetDetails.monthName})
                                            </h4>
                                        </div>
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                                            targetDetails.isTargetAchieved ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-500"
                                        )}>
                                            {targetDetails.isTargetAchieved ? "Achieved" : "In Progress"}
                                        </span>
                                    </div>

                                    <div className="flex items-baseline justify-between">
                                        <p className="text-xs font-bold text-slate-500">
                                            Referrals Completed
                                        </p>
                                        <p className="text-sm font-extrabold text-slate-800">
                                            {targetDetails.currentMonthReferralsCount} <span className="text-slate-400 font-bold">/ {targetDetails.monthlyTarget}</span>
                                        </p>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                        <div 
                                            className={cn(
                                                "h-full rounded-full transition-all duration-500",
                                                targetDetails.isTargetAchieved ? "bg-emerald-500" : "bg-amber-500"
                                            )}
                                            style={{ width: `${Math.min(100, (targetDetails.currentMonthReferralsCount / targetDetails.monthlyTarget) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ) : null}

                            {/* Tree view */}
                            {stats.total === 0 ? (
                                <div className="bg-white rounded-xl border border-slate-200/60 p-8 text-center space-y-2 shadow-sm">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                                        <Users size={32} />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-slate-800">No Referrals Yet</h4>
                                        <p className="text-xs text-slate-400">This customer hasn't referred any users yet.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm overflow-x-auto min-w-[320px]">
                                    {/* Root User Node */}
                                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3 shadow-sm">
                                        <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                            User
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-semibold text-slate-800 truncate">{treeData.name}</h4>
                                            <p className="text-[10px] text-slate-400 font-medium truncate">Ref Code: {treeData.referralCode} • {treeData.phone}</p>
                                        </div>
                                    </div>

                                    {/* Children tree */}
                                    {treeData.children && treeData.children.length > 0 && (
                                        <div className="mt-2 space-y-2 ml-[28px] relative">
                                            {treeData.children.map((child, idx) => (
                                                <ReferralNode
                                                    key={child._id}
                                                    node={child}
                                                    isLast={idx === treeData.children.length - 1}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

const ReferralsAndSubscriptions = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomerForTree, setSelectedCustomerForTree] = useState(null);
    const [filterPlan, setFilterPlan] = useState('all');
    const [customers, setCustomers] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isMlmModalOpen, setIsMlmModalOpen] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData(1);
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize, searchTerm, filterPlan]);

    const fetchData = async (requestedPage = 1) => {
        try {
            setLoading(true);
            const params = { page: requestedPage, limit: pageSize };
            if (searchTerm.trim()) params.search = searchTerm.trim();
            
            const { data } = await adminApi.getUsers(params);
            if (data.success) {
                const payload = data.result || {};
                let list = Array.isArray(payload.items) ? payload.items : (data.results || []);
                
                if (filterPlan === 'with-plan') {
                    list = list.filter(c => c.currentPlan && new Date(c.planExpiry) > new Date());
                } else if (filterPlan === 'referred') {
                    list = list.filter(c => c.referredBy);
                }

                setCustomers(list);
                setTotal(payload.total || list.length);
                setPage(payload.page || requestedPage);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load customer records");
        } finally {
            setLoading(false);
        }
    };

    const isPlanActive = (cust) => {
        return cust.currentPlan && cust.planExpiry && new Date(cust.planExpiry) > new Date();
    };

    const getFreeDeliveryUsage = (cust) => {
        if (!isPlanActive(cust)) return null;
        const feature = cust.currentPlan?.features?.find(f => f.key === 'FREE_DELIVERY');
        if (!feature || feature.value === false || feature.value === "0") return null;
        
        const limit = parseInt(feature.value, 10);
        const used = cust.monthlyOrders || 0;
        
        if (limit === -1) return { used, limit: 'Unlimited' };
        return { used, limit };
    };

    return (
        <div className="ds-section-spacing">
            <PageHeader
                title="Referrals & Plans"
                description="Monitor user subscriptions and referral networks"
                badge={
                    <div className="ds-stat-card-icon bg-amber-50">
                        <Gift className="ds-icon-lg text-amber-600" />
                    </div>
                }
                actions={
                    <button
                        type="button"
                        onClick={() => setIsMlmModalOpen(true)}
                        className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-orange-500/30 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                    >
                        <Sparkles className="w-4 h-4" />
                        <span>Customize MLM Banner</span>
                    </button>
                }
            />

            {/* Filter & Search Bar */}
            <Card className="ds-card-compact">
                <div className="flex flex-col lg:flex-row gap-3">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 ds-icon-sm text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by name, email or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="ds-input ds-input-icon-left focus:border-amber-500 focus:ring-amber-500/20"
                        />
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 lg:pb-0">
                        <div className="flex bg-gray-100 p-0.5 rounded-lg shrink-0">
                            {[
                                { id: 'all', label: 'All Users' },
                                { id: 'with-plan', label: 'Active Plan' },
                                { id: 'referred', label: 'Referred Users' }
                            ].map((f) => (
                                <button
                                    key={f.id}
                                    onClick={() => setFilterPlan(f.id)}
                                    className={cn(
                                        "px-4 py-2 rounded-md text-xs font-bold transition-all whitespace-nowrap",
                                        filterPlan === f.id ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            {/* List Table */}
            <Card className="overflow-hidden relative min-h-[400px]">
                {loading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                            <p className="ds-caption text-gray-500 font-medium">Loading Records...</p>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="ds-table">
                        <thead className="ds-table-header bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="ds-table-header-cell">Customer</th>
                                <th className="ds-table-header-cell">Referred By</th>
                                <th className="ds-table-header-cell">Active Plan</th>
                                <th className="ds-table-header-cell">Plan Usage (This Month)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {!loading && customers.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-slate-50 rounded-full">
                                                <Users className="h-8 w-8 text-slate-300" />
                                            </div>
                                            <p className="ds-h4 text-slate-400">No matching records found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                customers.map((cust) => {
                                    const hasPlan = isPlanActive(cust);
                                    const deliveryUsage = getFreeDeliveryUsage(cust);

                                    return (
                                        <tr key={cust.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={cust.avatar}
                                                        alt={cust.name}
                                                        className="h-10 w-10 rounded-xl bg-slate-100 object-cover"
                                                    />
                                                    <div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedCustomerForTree(cust)}
                                                            className="text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline text-left cursor-pointer transition-all focus:outline-none"
                                                        >
                                                            {cust.name}
                                                        </button>
                                                        <p className="text-xs font-semibold text-slate-500">{cust.phone}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            
                                            {/* Referred By */}
                                            <td className="px-6 py-4">
                                                {cust.referredBy ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                                                            <UserPlus className="h-4 w-4 text-indigo-500" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-700">{cust.referredBy.name || 'Unknown'}</p>
                                                            <p className="text-[10px] font-semibold text-slate-400">{cust.referredBy.phone}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-medium text-slate-400 italic">No Referrer</span>
                                                )}
                                            </td>

                                            {/* Plan Details */}
                                            <td className="px-6 py-4">
                                                {hasPlan ? (
                                                    <div>
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            <Award className="h-4 w-4 text-amber-500" />
                                                            <span className="text-sm font-black text-amber-600">
                                                                {cust.currentPlan?.name || 'Unknown Plan'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3 text-slate-400" />
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                                                                Valid till: {formatDate(cust.planExpiry)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Badge variant="neutral" className="text-[10px] uppercase font-bold tracking-widest bg-slate-100 text-slate-500 border-none">
                                                        No Active Plan
                                                    </Badge>
                                                )}
                                            </td>

                                            {/* Usage */}
                                            <td className="px-6 py-4">
                                                {hasPlan && deliveryUsage ? (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                                            <span>Free Deliveries Used:</span>
                                                            <span className={cn(deliveryUsage.used >= deliveryUsage.limit && deliveryUsage.limit !== 'Unlimited' ? "text-rose-500" : "text-emerald-600")}>
                                                                {deliveryUsage.used} / {deliveryUsage.limit}
                                                            </span>
                                                        </div>
                                                        {deliveryUsage.limit !== 'Unlimited' && (
                                                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={cn("h-full rounded-full transition-all duration-500", deliveryUsage.used >= deliveryUsage.limit ? "bg-rose-500" : "bg-emerald-500")}
                                                                    style={{ width: `${Math.min((deliveryUsage.used / deliveryUsage.limit) * 100, 100)}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-medium text-slate-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-3 border-t border-gray-100">
                    <Pagination
                        page={page}
                        totalPages={Math.ceil(total / pageSize) || 1}
                        total={total}
                        pageSize={pageSize}
                        onPageChange={(p) => fetchData(p)}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                        loading={loading}
                    />
                </div>
            </Card>
            {selectedCustomerForTree && (
                <ReferralTreeModal
                    isOpen={!!selectedCustomerForTree}
                    onClose={() => setSelectedCustomerForTree(null)}
                    customer={selectedCustomerForTree}
                />
            )}
            <MlmBannerManagerModal
                isOpen={isMlmModalOpen}
                onClose={() => setIsMlmModalOpen(false)}
            />
        </div>
    );
};

export default ReferralsAndSubscriptions;
