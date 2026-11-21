import React, { useEffect, useState } from 'react';
import { Loader2, CalendarClock } from 'lucide-react';
import { adminApi } from '../services/adminApi';

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm".
const toLocalInput = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Admin control for a platform banner's display priority and its optional
 * start/end window. Calls onSaved(updatedAd) after a successful save.
 */
const PlatformAdScheduleForm = ({ ad, onSaved, showToast }) => {
    const [priority, setPriority] = useState(ad?.priority ?? 0);
    const [startDate, setStartDate] = useState(toLocalInput(ad?.startDate));
    const [endDate, setEndDate] = useState(toLocalInput(ad?.endDate));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setPriority(ad?.priority ?? 0);
        setStartDate(toLocalInput(ad?.startDate));
        setEndDate(toLocalInput(ad?.endDate));
    }, [ad?._id, ad?.priority, ad?.startDate, ad?.endDate]);

    const handleSave = async () => {
        if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
            showToast?.('End date must be after start date', 'error');
            return;
        }
        setSaving(true);
        try {
            const res = await adminApi.updatePlatformAdSchedule(ad._id, {
                priority: Math.max(0, Math.round(Number(priority) || 0)),
                startDate: startDate ? new Date(startDate).toISOString() : null,
                endDate: endDate ? new Date(endDate).toISOString() : null,
            });
            showToast?.('Banner display settings saved', 'success');
            onSaved?.(res.data?.result || res.data);
        } catch (error) {
            showToast?.(error?.response?.data?.message || 'Failed to save banner display settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    const inputCls =
        'w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10';

    return (
        <div className="space-y-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-brand-500" /> Display Settings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Priority (higher first)</span>
                    <input
                        type="number"
                        min={0}
                        max={9999}
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className={inputCls}
                    />
                </label>
                <label className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Start (optional)</span>
                    <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                </label>
                <label className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">End (optional)</span>
                    <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
                </label>
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[11px] font-bold text-slate-400">
                    Empty dates mean no limit. The banner only shows while approved, paid and inside this window.
                </p>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2.5 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-50 inline-flex items-center gap-2"
                >
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save
                </button>
            </div>
        </div>
    );
};

export default PlatformAdScheduleForm;
