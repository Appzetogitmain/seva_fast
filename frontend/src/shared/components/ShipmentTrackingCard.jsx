import { useCallback, useEffect, useState } from 'react';
import { Truck, Copy, ExternalLink, RefreshCw, MapPin, CalendarClock } from 'lucide-react';
import axiosInstance from '@core/api/axios';
import { cn } from '@/lib/utils';

// Live Shiprocket tracking (AWB, courier, status, ETA, scan history) for the
// seller and admin panels. Uses the same /orders/:id/shipping-tracking endpoint
// as the customer app; the backend allows the owning seller and admins.

const formatDateTime = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const formatDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const ShipmentTrackingCard = ({ orderId, fallback = null, className }) => {
    const [tracking, setTracking] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const load = useCallback(async () => {
        const id = String(orderId || '').trim();
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const res = await axiosInstance.get(`/orders/${encodeURIComponent(id)}/shipping-tracking`);
            setTracking(res.data?.result || null);
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not load live tracking');
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    useEffect(() => {
        load();
    }, [load]);

    // Show stored details instantly / when the live call fails.
    const data = tracking || fallback || {};
    const awbCode = data.awbCode || null;
    const courierName = data.courierName || null;
    const status = data.currentStatus || data.status || null;
    const activities = Array.isArray(tracking?.activities) ? tracking.activities : [];

    const copyAwb = async () => {
        if (!awbCode) return;
        try {
            await navigator.clipboard.writeText(awbCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard unavailable */
        }
    };

    return (
        <div className={cn('rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-4', className)}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-700">Shiprocket Tracking</span>
                </div>
                <button
                    type="button"
                    onClick={load}
                    disabled={loading}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                >
                    <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
                    {loading ? 'Syncing' : 'Refresh'}
                </button>
            </div>

            {awbCode ? (
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Courier</p>
                        <p className="mt-0.5 font-black text-slate-900">{courierName || 'Courier partner'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">AWB</p>
                        <button
                            type="button"
                            onClick={copyAwb}
                            title="Copy AWB"
                            className="mt-0.5 inline-flex items-center gap-1 font-mono font-black text-slate-900 hover:text-indigo-700"
                        >
                            {awbCode}
                            <Copy className="h-3 w-3" />
                            {copied && <span className="font-sans text-[10px] text-emerald-600">Copied</span>}
                        </button>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</p>
                        <p className="mt-0.5 font-black uppercase text-indigo-700">{status || 'Created'}</p>
                    </div>
                    {tracking?.expectedDeliveryDate && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Expected Delivery</p>
                            <p className="mt-0.5 inline-flex items-center gap-1 font-black text-slate-900">
                                <CalendarClock className="h-3 w-3 text-slate-500" />
                                {formatDate(tracking.expectedDeliveryDate)}
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-1.5 text-xs">
                    <p className="font-medium text-slate-500">
                        {loading ? 'Checking Shiprocket…' : 'AWB not assigned yet.'}
                    </p>
                    {(tracking?.lastError || fallback?.lastError) && !loading && (
                        <p className="rounded-lg bg-rose-50 px-2.5 py-2 font-semibold text-rose-700">
                            Shiprocket could not create this shipment: {tracking?.lastError || fallback?.lastError}
                        </p>
                    )}
                </div>
            )}

            {(tracking?.origin || tracking?.destination) && (
                <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    {tracking.origin || '—'} → {tracking.destination || '—'}
                </p>
            )}

            {activities.length > 0 && (
                <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Tracking History</p>
                    <ol className="relative max-h-64 space-y-3 overflow-y-auto border-l-2 border-indigo-100 pl-4">
                        {activities.map((act, i) => (
                            <li key={`${act.date}-${i}`} className="relative">
                                <span
                                    className={cn(
                                        'absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white',
                                        i === 0 ? 'bg-indigo-600' : 'bg-slate-300'
                                    )}
                                />
                                <p className={cn('text-xs font-bold', i === 0 ? 'text-slate-900' : 'text-slate-700')}>
                                    {act.activity || act.status}
                                </p>
                                <p className="text-[10px] font-medium text-slate-500">
                                    {[formatDateTime(act.date), act.location].filter(Boolean).join(' · ')}
                                </p>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            {(tracking?.cancelError || fallback?.cancelError) && (
                <p className="rounded-lg bg-rose-50 px-2.5 py-2 text-[11px] font-semibold text-rose-700">
                    This order was cancelled, but Shiprocket did not cancel the shipment:{' '}
                    {tracking?.cancelError || fallback?.cancelError}. Please cancel it from the Shiprocket dashboard.
                </p>
            )}
            {(tracking?.cancelledOnShiprocket || fallback?.cancelledOnShiprocket) && (
                <p className="text-[11px] font-bold text-emerald-700">Shipment cancelled on Shiprocket</p>
            )}

            {error && !tracking && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}

            {tracking?.trackingUrl && (
                <a
                    href={tracking.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:underline"
                >
                    Open on Shiprocket <ExternalLink className="h-3 w-3" />
                </a>
            )}
        </div>
    );
};

export default ShipmentTrackingCard;
