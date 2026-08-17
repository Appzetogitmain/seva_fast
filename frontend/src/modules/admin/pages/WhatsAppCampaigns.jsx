import React, { useEffect, useMemo, useState } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import Pagination from '@shared/components/ui/Pagination';
import PageHeader from '@shared/components/ui/PageHeader';
import { useToast } from '@shared/components/ui/Toast';
import {
    HiOutlinePlus,
    HiOutlineChatBubbleLeftRight,
    HiOutlineXMark,
    HiOutlineUsers,
    HiOutlineClock,
    HiOutlineExclamationTriangle,
    HiOutlineCheckCircle,
    HiOutlineEye,
    HiOutlineMagnifyingGlass,
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { adminApi } from '../services/adminApi';
import { formatDate } from '@shared/utils/formatDate';

const CAMPAIGN_TYPES = ['announcement', 'offer', 'sale', 'new_launch', 'new_service', 'festival', 'custom'];

const STATUS_VARIANT = {
    draft: 'gray',
    scheduled: 'warning',
    sending: 'warning',
    sent: 'success',
    failed: 'error',
    cancelled: 'gray',
};

const MESSAGE_STATUS_VARIANT = {
    queued: 'gray',
    sent: 'warning',
    delivered: 'success',
    read: 'success',
    failed: 'error',
};

const emptyForm = {
    title: '',
    campaignType: 'announcement',
    message: '',
    audienceType: 'all',
    targetCustomerIds: [],
    scheduleType: 'immediate',
    scheduledAt: '',
};

const WhatsAppCampaigns = () => {
    const { showToast } = useToast();

    const [configStatus, setConfigStatus] = useState(null);
    const [campaigns, setCampaigns] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [statusFilter, setStatusFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState(emptyForm);

    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);

    const [messagesModalCampaign, setMessagesModalCampaign] = useState(null);
    const [campaignMessages, setCampaignMessages] = useState([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const fetchConfigStatus = async () => {
        try {
            const { data } = await adminApi.getWhatsAppConfigStatus();
            if (data.success) setConfigStatus(data.result);
        } catch {
            // status banner is best-effort
        }
    };

    const fetchCampaigns = async (requestedPage = page) => {
        try {
            setIsLoading(true);
            const params = { page: requestedPage, limit: pageSize };
            if (statusFilter !== 'all') params.status = statusFilter;
            const { data } = await adminApi.getWhatsAppCampaigns(params);
            if (data.success) {
                const result = data.result || {};
                setCampaigns(Array.isArray(result.items) ? result.items : []);
                setTotal(Number(result.total || 0));
                setPage(Number(result.page || requestedPage));
            }
        } catch (error) {
            showToast(error?.response?.data?.message || 'Failed to load WhatsApp campaigns', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConfigStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchCampaigns(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, pageSize]);

    useEffect(() => {
        if (!customerSearch.trim()) {
            setCustomerResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                setIsSearchingCustomers(true);
                const { data } = await adminApi.getUsers({ page: 1, limit: 20, search: customerSearch.trim() });
                const items = Array.isArray(data?.result?.items) ? data.result.items : [];
                setCustomerResults(items);
            } catch {
                setCustomerResults([]);
            } finally {
                setIsSearchingCustomers(false);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [customerSearch]);

    const resetForm = () => {
        setForm(emptyForm);
        setSelectedCustomers([]);
        setCustomerSearch('');
        setCustomerResults([]);
    };

    const openCreateModal = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const closeCreateModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        resetForm();
    };

    const toggleCustomer = (customer) => {
        setSelectedCustomers((prev) => {
            const exists = prev.some((c) => c.id === customer.id);
            if (exists) return prev.filter((c) => c.id !== customer.id);
            return [...prev, customer];
        });
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;
        if (!form.title.trim() || !form.message.trim()) {
            showToast('Title and message are required', 'warning');
            return;
        }
        if (form.audienceType === 'selected' && selectedCustomers.length === 0) {
            showToast('Select at least one customer for a targeted campaign', 'warning');
            return;
        }
        if (form.scheduleType === 'scheduled' && !form.scheduledAt) {
            showToast('Pick a future date/time for a scheduled campaign', 'warning');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                title: form.title.trim(),
                campaignType: form.campaignType,
                message: form.message.trim(),
                audienceType: form.audienceType,
                targetCustomerIds: form.audienceType === 'selected' ? selectedCustomers.map((c) => c.id) : undefined,
                scheduleType: form.scheduleType,
                scheduledAt: form.scheduleType === 'scheduled' ? new Date(form.scheduledAt).toISOString() : undefined,
            };

            await adminApi.createWhatsAppCampaign(payload);
            showToast(
                form.scheduleType === 'immediate' ? 'Campaign created and dispatching now' : 'Campaign scheduled',
                'success',
            );
            setIsModalOpen(false);
            resetForm();
            fetchCampaigns(1);
        } catch (error) {
            showToast(error?.response?.data?.message || 'Failed to create campaign', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancelCampaign = async (campaign) => {
        try {
            await adminApi.cancelWhatsAppCampaign(campaign._id);
            showToast('Campaign cancelled', 'success');
            fetchCampaigns(page);
        } catch (error) {
            showToast(error?.response?.data?.message || 'Failed to cancel campaign', 'error');
        }
    };

    const openMessagesModal = async (campaign) => {
        setMessagesModalCampaign(campaign);
        setCampaignMessages([]);
        try {
            setIsLoadingMessages(true);
            const { data } = await adminApi.getWhatsAppCampaignMessages(campaign._id, { page: 1, limit: 100 });
            setCampaignMessages(Array.isArray(data?.result?.items) ? data.result.items : []);
        } catch (error) {
            showToast(error?.response?.data?.message || 'Failed to load campaign messages', 'error');
        } finally {
            setIsLoadingMessages(false);
        }
    };

    const filters = ['all', 'draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'];

    const configWarning = useMemo(() => {
        if (!configStatus) return null;
        if (!configStatus.enabled) {
            return 'WhatsApp is disabled (WHATSAPP_ENABLED=false). Campaigns will be created but sends will fail until it is enabled.';
        }
        if (!configStatus.configured) {
            return 'WhatsApp is enabled but not fully configured (missing Tezsender API key). Sends will fail until it is set.';
        }
        return null;
    }, [configStatus]);

    return (
        <div className="ds-section-spacing">
            <PageHeader
                title="WhatsApp Campaigns"
                description="Send plain-text WhatsApp broadcasts to your customers via Tezsender."
                badge={
                    <Badge variant="success" className="ds-badge ds-badge-success">
                        Tezsender
                    </Badge>
                }
                actions={
                    <button onClick={openCreateModal} className="ds-btn ds-btn-md bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-2">
                        <HiOutlinePlus className="h-4 w-4" />
                        New Campaign
                    </button>
                }
            />

            {configWarning && (
                <Card className="ds-card-compact bg-amber-50 border-amber-100">
                    <div className="flex gap-3 items-start">
                        <HiOutlineExclamationTriangle className="ds-icon-lg text-amber-600 flex-shrink-0" />
                        <p className="ds-body text-amber-800">{configWarning}</p>
                    </div>
                </Card>
            )}

            <Card className="ds-card-standard">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="ds-stat-card-icon bg-emerald-50">
                            <HiOutlineChatBubbleLeftRight className="ds-icon-lg text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="ds-h3">Campaigns</h3>
                            <p className="ds-caption text-slate-400">{total} total</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-2xl flex-wrap">
                        {filters.map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setStatusFilter(filter)}
                                className={cn(
                                    'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                                    statusFilter === filter ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600',
                                )}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-50">
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Campaign</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Audience</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Schedule</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Stats</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading && (
                                <tr>
                                    <td colSpan="6" className="text-center py-8 text-slate-400 text-sm">
                                        Loading campaigns...
                                    </td>
                                </tr>
                            )}
                            {!isLoading && campaigns.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="text-center py-16">
                                        <div className="h-16 w-16 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                                            <HiOutlineChatBubbleLeftRight className="h-8 w-8 text-slate-200" />
                                        </div>
                                        <p className="ds-h4 text-slate-900">No campaigns yet</p>
                                        <p className="ds-caption text-slate-400 mt-1">Create your first WhatsApp broadcast.</p>
                                    </td>
                                </tr>
                            )}
                            {!isLoading && campaigns.map((c) => (
                                <tr key={c._id} className="group hover:bg-slate-50/30 transition-colors">
                                    <td className="px-4 py-6">
                                        <p className="text-sm font-black text-slate-900">{c.title}</p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-1 capitalize">{c.campaignType?.replace(/_/g, ' ')}</p>
                                    </td>
                                    <td className="px-4 py-6">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <HiOutlineUsers className="h-4 w-4" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                                {c.audienceType === 'selected' ? `${c.targetCustomerIds?.length || 0} selected` : 'All customers'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-6">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <HiOutlineClock className="h-4 w-4" />
                                            <span className="text-[10px] font-bold uppercase tracking-tighter">
                                                {c.scheduleType === 'scheduled' && c.scheduledAt ? formatDate(c.scheduledAt) : 'Immediate'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-6">
                                        <div className="flex items-center gap-3 text-[10px] font-black">
                                            <span className="text-emerald-600">{c.stats?.sent || 0} sent</span>
                                            <span className="text-rose-500">{c.stats?.failed || 0} failed</span>
                                            <span className="text-slate-400">{c.stats?.skipped || 0} skipped</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-6 text-center">
                                        <Badge variant={STATUS_VARIANT[c.status] || 'gray'} className="text-[9px] font-black uppercase">
                                            {c.status}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-6">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openMessagesModal(c)}
                                                className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                                                title="View message log"
                                            >
                                                <HiOutlineEye className="h-5 w-5" />
                                            </button>
                                            {c.status === 'scheduled' && (
                                                <button
                                                    onClick={() => handleCancelCampaign(c)}
                                                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                    title="Cancel campaign"
                                                >
                                                    <HiOutlineXMark className="h-5 w-5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="pt-4">
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        total={total}
                        pageSize={pageSize}
                        onPageChange={(p) => fetchCampaigns(p)}
                        onPageSizeChange={(size) => setPageSize(size)}
                        loading={isLoading}
                    />
                </div>
            </Card>

            {/* Create campaign modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeCreateModal}
                title="New WhatsApp Campaign"
                size="lg"
                footer={
                    <>
                        <button onClick={closeCreateModal} className="ds-btn ds-btn-md bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50">
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="ds-btn ds-btn-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Creating...' : form.scheduleType === 'immediate' ? 'Send Now' : 'Schedule Campaign'}
                        </button>
                    </>
                }
            >
                <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="ds-label">Campaign Title</label>
                            <input
                                value={form.title}
                                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                                className="ds-input w-full"
                                placeholder="Diwali Sale Blast"
                                maxLength={120}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="ds-label">Campaign Type</label>
                            <select
                                value={form.campaignType}
                                onChange={(e) => setForm((p) => ({ ...p, campaignType: e.target.value }))}
                                className="ds-input w-full capitalize"
                            >
                                {CAMPAIGN_TYPES.map((t) => (
                                    <option key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="ds-label">Message</label>
                        <textarea
                            rows={4}
                            value={form.message}
                            onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                            className="ds-textarea w-full resize-none"
                            placeholder="Hi {name}, enjoy 20% off this festive season!"
                            maxLength={1024}
                        />
                        <p className="ds-caption text-slate-400">This exact text is sent to each recipient. Use {'{name}'} to insert the customer's name.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="ds-label">Audience</label>
                            <div className="flex gap-2">
                                {['all', 'selected'].map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setForm((p) => ({ ...p, audienceType: type }))}
                                        className={cn(
                                            'flex-1 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest ring-1 transition-all',
                                            form.audienceType === type
                                                ? 'bg-slate-900 text-white ring-slate-900'
                                                : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300',
                                        )}
                                    >
                                        {type === 'all' ? 'All Customers' : 'Selected Customers'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="ds-label">Schedule</label>
                            <div className="flex gap-2">
                                {['immediate', 'scheduled'].map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setForm((p) => ({ ...p, scheduleType: type }))}
                                        className={cn(
                                            'flex-1 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest ring-1 transition-all',
                                            form.scheduleType === type
                                                ? 'bg-slate-900 text-white ring-slate-900'
                                                : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300',
                                        )}
                                    >
                                        {type === 'immediate' ? 'Send Now' : 'Schedule'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {form.scheduleType === 'scheduled' && (
                        <div className="space-y-2">
                            <label className="ds-label">Scheduled At</label>
                            <input
                                type="datetime-local"
                                value={form.scheduledAt}
                                onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                                className="ds-input w-full"
                            />
                        </div>
                    )}

                    {form.audienceType === 'selected' && (
                        <div className="space-y-2">
                            <label className="ds-label">Search Customers</label>
                            <div className="relative">
                                <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                    className="ds-input w-full pl-9"
                                    placeholder="Search by name or phone..."
                                />
                            </div>

                            {selectedCustomers.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {selectedCustomers.map((c) => (
                                        <span
                                            key={c.id}
                                            className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-[10px] font-bold px-2.5 py-1 rounded-lg"
                                        >
                                            {c.name || c.phone}
                                            <button onClick={() => toggleCustomer(c)} type="button">
                                                <HiOutlineXMark className="h-3 w-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {isSearchingCustomers && <p className="ds-caption text-slate-400">Searching...</p>}

                            {customerResults.length > 0 && (
                                <div className="max-h-48 overflow-y-auto rounded-xl ring-1 ring-slate-100 divide-y divide-slate-50">
                                    {customerResults.map((c) => {
                                        const isSelected = selectedCustomers.some((s) => s.id === c.id);
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => toggleCustomer(c)}
                                                className={cn(
                                                    'w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 transition-colors',
                                                    isSelected && 'bg-primary/5',
                                                )}
                                            >
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">{c.name || 'Unnamed'}</p>
                                                    <p className="text-[10px] text-slate-400">{c.phone}</p>
                                                </div>
                                                {isSelected && <HiOutlineCheckCircle className="h-4 w-4 text-primary" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Campaign messages modal */}
            <Modal
                isOpen={Boolean(messagesModalCampaign)}
                onClose={() => setMessagesModalCampaign(null)}
                title={messagesModalCampaign ? `Messages · ${messagesModalCampaign.title}` : 'Messages'}
                size="lg"
            >
                <div className="space-y-2">
                    {isLoadingMessages && <p className="ds-caption text-slate-400">Loading...</p>}
                    {!isLoadingMessages && campaignMessages.length === 0 && (
                        <p className="ds-caption text-slate-400">No messages recorded yet for this campaign.</p>
                    )}
                    {!isLoadingMessages && campaignMessages.map((m) => (
                        <div key={m._id} className="flex items-center justify-between px-3 py-2.5 rounded-xl ring-1 ring-slate-100">
                            <div>
                                <p className="text-xs font-bold text-slate-800">{m.customer?.name || 'Unknown'}</p>
                                <p className="text-[10px] text-slate-400">{m.phone}</p>
                                {m.failureReason && <p className="text-[10px] text-rose-500 mt-0.5">{m.failureReason}</p>}
                            </div>
                            <Badge variant={MESSAGE_STATUS_VARIANT[m.status] || 'gray'} className="text-[9px] font-black uppercase">
                                {m.status}
                            </Badge>
                        </div>
                    ))}
                </div>
            </Modal>
        </div>
    );
};

export default WhatsAppCampaigns;
