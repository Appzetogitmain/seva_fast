import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import PageHeader from '@shared/components/ui/PageHeader';
import StatCard from '@shared/components/ui/StatCard';
import {
    Users,
    Search,
    Download,
    Eye,
    Phone,
    ShoppingBag,
    MoreVertical,
    UserPlus,
    RotateCw,
    Activity,
    Loader2,
    Copy,
    Ban,
    CheckCircle2,
    Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import Modal from '@shared/components/ui/Modal';
import { useAuth } from '@core/context/AuthContext';
import { isSameCalendarDay } from '@shared/utils/formatDate';

const CustomerManagement = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [isExporting, setIsExporting] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState(null);
    const { user } = useAuth();
    // Block / delete are main-admin only (the backend enforces this too).
    const isMainAdmin = user?.role !== 'sub-admin';
    const [confirmAction, setConfirmAction] = useState(null); // { type: 'block'|'unblock'|'delete', customer }
    const [actionLoading, setActionLoading] = useState(false);

    const runConfirmedAction = async () => {
        if (!confirmAction) return;
        const { type, customer } = confirmAction;
        setActionLoading(true);
        try {
            if (type === 'delete') {
                await adminApi.deleteUser(customer.id);
                setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
                setTotal((t) => Math.max(t - 1, 0));
                toast.success(`${customer.name || 'Customer'} deleted permanently`);
            } else {
                const isActive = type === 'unblock';
                await adminApi.setUserStatus(customer.id, isActive);
                setCustomers((prev) => prev.map((c) => (c.id === customer.id ? { ...c, status: isActive ? 'active' : 'inactive' } : c)));
                toast.success(isActive ? 'Customer unblocked' : 'Customer blocked: they are logged out and cannot log in');
            }
            setConfirmAction(null);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Action failed');
        } finally {
            setActionLoading(false);
        }
    };

    // Close the row action menu on any outside click / Escape.
    useEffect(() => {
        if (!openMenuId) return undefined;
        const close = () => setOpenMenuId(null);
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('click', close);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('click', close);
            document.removeEventListener('keydown', onKey);
        };
    }, [openMenuId]);

    const copyPhone = async (phone) => {
        try {
            await navigator.clipboard.writeText(phone);
            toast.success('Phone number copied');
        } catch {
            toast.error('Could not copy phone number');
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCustomers(1);
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize, searchTerm, filterStatus]);
    const fetchCustomers = async (requestedPage = 1) => {
        try {
            setLoading(true);
            const params = { page: requestedPage, limit: pageSize };
            if (searchTerm.trim()) params.search = searchTerm.trim();
            if (filterStatus !== 'all') params.status = filterStatus;
            const { data } = await adminApi.getUsers(params);
            if (data.success) {
                const payload = data.result || {};
                const list = Array.isArray(payload.items) ? payload.items : (data.results || []);
                setCustomers(list);
                if (typeof payload.total === 'number') {
                    setTotal(payload.total);
                } else {
                    setTotal(list.length);
                }
                if (typeof payload.page === 'number') {
                    setPage(payload.page);
                } else {
                    setPage(requestedPage);
                }
            }
        } catch (error) {
            console.error("Error fetching customers:", error);
            toast.error("Failed to load customers");
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        const safeCustomers = Array.isArray(customers) ? customers : [];
        return {
            total: total,
            active: safeCustomers.filter(c => c.status === 'active').length,
            newToday: safeCustomers.filter(c => isSameCalendarDay(c.joinedDate)).length
        };
    }, [customers, total]);

    const filteredCustomers = useMemo(() => {
        const safeCustomers = Array.isArray(customers) ? customers : [];
        return safeCustomers.filter(c => {
            const matchesSearch = (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.phone || '').includes(searchTerm);
            const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [customers, searchTerm, filterStatus]);

    const handleExport = () => {
        setIsExporting(true);
        setTimeout(() => {
            setIsExporting(false);
            toast.success('Customer database exported successfully!');
        }, 1500);
    };

    const getTimeAgo = (date) => {
        if (!date) return 'Never';
        const now = new Date();
        const past = new Date(date);
        const diffInMs = now - past;
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

        if (diffInHours < 1) return 'Recently';
        if (diffInHours < 24) return `${diffInHours}h ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
    };

    return (
        <div className="ds-section-spacing">
            <PageHeader
                title="Customers"
                description="Manage and track all customer accounts"
                badge={
                    <div className="ds-stat-card-icon bg-brand-50">
                        <Users className="ds-icon-lg text-brand-600" />
                    </div>
                }
                actions={
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="ds-btn ds-btn-md bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                        {isExporting ? <RotateCw className="ds-icon-sm animate-spin" /> : <Download className="ds-icon-sm" />}
                        {isExporting ? 'EXPORTING...' : 'EXPORT'}
                    </button>
                }
            />

            {/* Quick Stats Grid */}
            <div className="ds-grid-cards-3">
                <StatCard
                    label="Total Customers"
                    value={stats.total}
                    icon={Users}
                    color="text-brand-600"
                    bg="bg-brand-50"
                />
                <StatCard
                    label="Active Users"
                    value={stats.active}
                    icon={Activity}
                    color="text-brand-600"
                    bg="bg-brand-50"
                />
                <StatCard
                    label="New Today"
                    value={stats.newToday}
                    icon={UserPlus}
                    color="text-brand-600"
                    bg="bg-brand-50"
                />
            </div>

            {/* Filter & Search Bar */}
            <Card className="ds-card-compact">
                <div className="flex flex-col lg:flex-row gap-3">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 ds-icon-sm text-gray-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by name, email or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="ds-input ds-input-icon-left"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex bg-gray-100 p-0.5 rounded-lg">
                            {['all', 'active', 'inactive'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md ds-caption transition-all",
                                        filterStatus === status ? "bg-white text-primary shadow-sm" : "text-gray-400 hover:text-gray-600"
                                    )}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Customer List Table */}
            <Card className="overflow-hidden relative min-h-[400px]">
                {loading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            <p className="ds-caption text-gray-500 font-medium">Loading Customers...</p>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="ds-table">
                        <thead className="ds-table-header">
                            <tr>
                                <th className="ds-table-header-cell">Customer</th>
                                <th className="ds-table-header-cell">Activity</th>
                                <th className="ds-table-header-cell">Total Spend</th>
                                <th className="ds-table-header-cell">Status</th>
                                <th className="ds-table-header-cell text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && filteredCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-gray-50 rounded-full">
                                                <Users className="h-8 w-8 text-gray-300" />
                                            </div>
                                            <p className="ds-h4 text-gray-400">No customers found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredCustomers.map((cust, rowIndex) => (
                                    <tr key={cust.id} className="ds-table-row">
                                        <td className="ds-table-cell">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src="https://cdn-icons-png.flaticon.com/512/149/149071.png"
                                                    alt=""
                                                    className="h-10 w-10 rounded-lg bg-gray-100 ring-2 ring-white shadow-sm object-cover"
                                                />
                                                <div>
                                                    <p
                                                        onClick={() => navigate(`/admin/customers/${cust.id}`)}
                                                        className="ds-h4 hover:text-primary cursor-pointer transition-colors"
                                                    >
                                                        {cust.name}
                                                    </p>
                                                    <p className="ds-body-sm text-gray-500">{cust.email || 'No email'}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <Phone className="ds-icon-sm text-gray-300" />
                                                        <span className="text-[9px] text-gray-400">{cust.phone}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="ds-table-cell">
                                            <div>
                                                <div className="flex items-center gap-1.5 ds-body font-semibold">
                                                    <ShoppingBag className="ds-icon-sm text-primary" />
                                                    {cust.totalOrders} Orders
                                                </div>
                                                <p className="ds-body-sm text-gray-400 mt-0.5">Last: {getTimeAgo(cust.lastOrderDate)}</p>
                                            </div>
                                        </td>
                                        <td className="ds-table-cell ds-h4">
                                            ₹{(cust.totalSpent || 0).toLocaleString()}
                                        </td>
                                        <td className="ds-table-cell">
                                            <Badge
                                                variant={cust.status === 'active' ? 'success' : 'error'}
                                                className="ds-badge"
                                            >
                                                {cust.status}
                                            </Badge>
                                        </td>
                                        <td className="ds-table-cell text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/admin/customers/${cust.id}`)}
                                                    className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-all"
                                                >
                                                    <Eye className="ds-icon-sm" />
                                                </button>
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(openMenuId === cust.id ? null : cust.id);
                                                        }}
                                                        className={cn(
                                                            "p-2 rounded-lg transition-all",
                                                            openMenuId === cust.id ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-400 hover:bg-gray-900 hover:text-white"
                                                        )}
                                                        aria-label="More actions"
                                                    >
                                                        <MoreVertical className="ds-icon-sm" />
                                                    </button>
                                                    {openMenuId === cust.id && (
                                                        <div
                                                            onClick={(e) => e.stopPropagation()}
                                                            className={cn("absolute right-0 w-48", rowIndex >= Math.max(filteredCustomers.length - 2, 2) ? "bottom-full mb-2" : "top-full mt-2", " bg-white rounded-xl shadow-xl ring-1 ring-gray-100 py-1.5 z-30 text-left")}
                                                        >
                                                            {[
                                                                { label: 'View Details', icon: Eye, onClick: () => navigate(`/admin/customers/${cust.id}`) },
                                                                { label: 'View Orders', icon: ShoppingBag, onClick: () => navigate(`/admin/orders/all?customerId=${cust.id}&customerName=${encodeURIComponent(cust.name || '')}`) },
                                                                cust.phone && { label: 'Call Customer', icon: Phone, onClick: () => { window.location.href = `tel:${cust.phone}`; } },
                                                                cust.phone && { label: 'Copy Phone', icon: Copy, onClick: () => copyPhone(cust.phone) },
                                                                isMainAdmin && (cust.status === 'active'
                                                                    ? { label: 'Block Customer', icon: Ban, danger: true, onClick: () => setConfirmAction({ type: 'block', customer: cust }) }
                                                                    : { label: 'Unblock Customer', icon: CheckCircle2, onClick: () => setConfirmAction({ type: 'unblock', customer: cust }) }),
                                                                isMainAdmin && { label: 'Delete Profile', icon: Trash2, danger: true, onClick: () => setConfirmAction({ type: 'delete', customer: cust }) },
                                                            ].filter(Boolean).map((item) => (
                                                                <button
                                                                    key={item.label}
                                                                    onClick={() => { setOpenMenuId(null); item.onClick(); }}
                                                                    className={cn(
                                                                        "w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-semibold hover:bg-gray-50",
                                                                        item.danger ? "text-rose-600" : "text-gray-700"
                                                                    )}
                                                                >
                                                                    <item.icon className={cn("h-4 w-4", item.danger ? "text-rose-500" : "text-gray-400")} />
                                                                    {item.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
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
                        onPageChange={(p) => fetchCustomers(p)}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                        loading={loading}
                    />
                </div>
            </Card>

            <Modal
                isOpen={Boolean(confirmAction)}
                onClose={() => !actionLoading && setConfirmAction(null)}
                title={
                    confirmAction?.type === 'delete' ? 'Delete customer permanently?'
                        : confirmAction?.type === 'block' ? 'Block this customer?'
                            : 'Unblock this customer?'
                }
                footer={
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setConfirmAction(null)}
                            disabled={actionLoading}
                            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={runConfirmedAction}
                            disabled={actionLoading}
                            className={cn(
                                "px-4 py-2 rounded-xl text-white text-sm font-bold flex items-center gap-2 disabled:opacity-60",
                                confirmAction?.type === 'unblock' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                            )}
                        >
                            {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {confirmAction?.type === 'delete' ? 'Delete Permanently' : confirmAction?.type === 'block' ? 'Block' : 'Unblock'}
                        </button>
                    </div>
                }
            >
                {confirmAction && (
                    <div className="space-y-3 text-sm text-gray-600">
                        <p>
                            <span className="font-bold text-gray-900">{confirmAction.customer.name || 'Customer'}</span>
                            {confirmAction.customer.phone ? ` (${confirmAction.customer.phone})` : ''}
                        </p>
                        {confirmAction.type === 'block' && (
                            <p>They will be logged out within a minute and cannot log in or place orders until you unblock them. Their data is kept.</p>
                        )}
                        {confirmAction.type === 'unblock' && (
                            <p>They will be able to log in and place orders again.</p>
                        )}
                        {confirmAction.type === 'delete' && (
                            <>
                                <p>This permanently removes their profile, cart, wishlist and notification settings. <span className="font-bold text-rose-600">This cannot be undone.</span></p>
                                <p>Past orders, payments and wallet transactions are kept for accounting and will show as "Deleted customer". Any wallet balance is lost.</p>
                                <p>Deletion is refused while they have active orders or open returns. If the same phone number signs up again, it becomes a brand-new account.</p>
                            </>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default CustomerManagement;
