// Premium Billing & Financial Configuration System
import React, { useState, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import {
    RotateCcw,
    Save,
    Info,
    Truck,
    Settings,
    MapPin,
    History,
    Percent,
    Users,
    Award,
    Megaphone,
    ShieldCheck,
    Bike,
    Plus,
    Trash2,
    Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import { adminApi } from '../services/adminApi';

const SlabEditorTable = ({ rows, valueField, valueLabel, onUpdate, onAdd, onRemove }) => {
    const isFeeTable = valueField === 'fee';
    return (
        <div className="space-y-2">
            <div className={cn(
                "grid gap-2 px-1 text-[9px] font-black text-slate-400 uppercase tracking-widest",
                isFeeTable ? "grid-cols-[1fr_1fr_1fr_1.3fr_32px]" : "grid-cols-[1fr_1fr_1fr_32px]"
            )}>
                <span>Min (km)</span>
                <span>Max (km)</span>
                <span>{valueLabel}</span>
                {isFeeTable && <span>Free above order (₹)</span>}
                <span />
            </div>
            {rows.map((row, index) => (
                <div
                    key={index}
                    className={cn(
                        "grid gap-2 items-center bg-slate-50 rounded-xl p-2",
                        isFeeTable ? "grid-cols-[1fr_1fr_1fr_1.3fr_32px]" : "grid-cols-[1fr_1fr_1fr_32px]"
                    )}
                >
                    <input
                        type="number" min="0" step="0.1"
                        value={row.minKm}
                        onChange={(e) => onUpdate(index, 'minKm', e.target.value)}
                        className="w-full px-3 py-2 bg-white rounded-lg text-xs font-bold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-brand-400"
                    />
                    <input
                        type="number" min="0" step="0.1"
                        value={row.maxKm ?? ''}
                        placeholder="No limit"
                        onChange={(e) => onUpdate(index, 'maxKm', e.target.value)}
                        className="w-full px-3 py-2 bg-white rounded-lg text-xs font-bold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-brand-400 placeholder:text-slate-300 placeholder:font-medium"
                    />
                    <input
                        type="number" min="0"
                        value={row[valueField]}
                        onChange={(e) => onUpdate(index, valueField, e.target.value)}
                        className="w-full px-3 py-2 bg-white rounded-lg text-xs font-bold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-brand-400"
                    />
                    {isFeeTable && (
                        <input
                            type="number" min="0"
                            value={row.freeAboveOrderValue ?? ''}
                            placeholder="Never free"
                            onChange={(e) => onUpdate(index, 'freeAboveOrderValue', e.target.value)}
                            className="w-full px-3 py-2 bg-white rounded-lg text-xs font-bold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-brand-400 placeholder:text-slate-300 placeholder:font-medium"
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => onRemove(index)}
                        disabled={rows.length <= 1}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={onAdd}
                className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
            >
                <Plus className="h-3.5 w-3.5" /> Add distance band
            </button>
        </div>
    );
};

const BillingCharges = () => {
    const { showToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [deliveryMode, setDeliveryMode] = useState('distance'); // 'fixed' or 'distance'
    const [returnDeliveryCommission, setReturnDeliveryCommission] = useState(0);

    const [config, setConfig] = useState({
        minimumOrderValue: 0,
        fixedCharge: 30,
        handlingFeeStrategy: "highest_category_fee",
        codEnabled: true,
        onlineEnabled: true,
    });

    const DEFAULT_DELIVERY_FEE_SLABS = [
        { minKm: 0, maxKm: 5, fee: 40, freeAboveOrderValue: 500 },
        { minKm: 5, maxKm: 10, fee: 60, freeAboveOrderValue: null },
        { minKm: 10, maxKm: 15, fee: 80, freeAboveOrderValue: null },
        { minKm: 15, maxKm: null, fee: 100, freeAboveOrderValue: null },
    ];
    const DEFAULT_RIDER_EARNING_SLABS = [
        { minKm: 0, maxKm: 5, earning: 30 },
        { minKm: 5, maxKm: 10, earning: 45 },
        { minKm: 10, maxKm: 15, earning: 60 },
        { minKm: 15, maxKm: null, earning: 80 },
    ];

    const [deliveryFeeSlabs, setDeliveryFeeSlabs] = useState(DEFAULT_DELIVERY_FEE_SLABS);
    const [riderEarningSlabs, setRiderEarningSlabs] = useState(DEFAULT_RIDER_EARNING_SLABS);
    const [slabExtras, setSlabExtras] = useState({
        deliveryFeeBaseWeightKg: 2,
        deliveryFeeExtraFeePerKg: 10,
        expressDeliveryEnabled: true,
        expressDeliveryFee: 150,
        expressDeliveryMaxWeightKg: 5,
        riderEarningBaseWeightKg: 2,
        riderEarningExtraFeePerKg: 10,
        riderExpressEarning: 100,
        riderExtraEarningPerKmBeyondSlabs: 0,
    });

    const [commissions, setCommissions] = useState({
        adminCommissionPercent: 5,
        technicalChargePercent: 5,
        subAdminCommissionPercent: 10,
        fieldWorkerCommissionPercent: 5,
        goldCardMemberDiscountPercent: 10,
        silverCardMemberDiscountPercent: 5,
        bronzeCardMemberDiscountPercent: 2.5,
        directSlabCommissionPercent: 25,
        deductShippingBeforeCommission: true,
        advertiseChargePercent: 5,
        siteCashbackPercent: 15,
        otherMaintenancePercent: 7.5,
        affiliateMarketingPercent: 5,
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const [platformRes, deliveryRes] = await Promise.all([
                    adminApi.getPlatformSettings(),
                    adminApi.getDeliveryFinanceSettings(),
                ]);

                if (platformRes.data?.success && platformRes.data.result) {
                    const r = platformRes.data.result;
                    setReturnDeliveryCommission(r.returnDeliveryCommission ?? 0);
                    setCommissions({
                        adminCommissionPercent: r.adminCommissionPercent ?? 5,
                        technicalChargePercent: r.technicalChargePercent ?? 5,
                        subAdminCommissionPercent: r.subAdminCommissionPercent ?? 10,
                        fieldWorkerCommissionPercent: r.fieldWorkerCommissionPercent ?? 5,
                        goldCardMemberDiscountPercent: r.goldCardMemberDiscountPercent ?? 10,
                        silverCardMemberDiscountPercent: r.silverCardMemberDiscountPercent ?? 5,
                        bronzeCardMemberDiscountPercent: r.bronzeCardMemberDiscountPercent ?? 2.5,
                        directSlabCommissionPercent: r.directSlabCommissionPercent ?? 25,
                        deductShippingBeforeCommission: r.deductShippingBeforeCommission ?? true,
                        advertiseChargePercent: r.advertiseChargePercent ?? 5,
                        siteCashbackPercent: r.siteCashbackPercent ?? 15,
                        otherMaintenancePercent: r.otherMaintenancePercent ?? 7.5,
                        affiliateMarketingPercent: r.affiliateMarketingPercent ?? 5,
                    });
                }

                if (deliveryRes.data?.success && deliveryRes.data.result) {
                    const s = deliveryRes.data.result;
                    setDeliveryMode(s.deliveryPricingMode === 'fixed_price' ? 'fixed' : 'distance');
                    setConfig((prev) => ({
                        ...prev,
                        minimumOrderValue: s.minimumOrderValue ?? prev.minimumOrderValue,
                        fixedCharge: s.fixedDeliveryFee ?? s.customerBaseDeliveryFee ?? prev.fixedCharge,
                        handlingFeeStrategy: s.handlingFeeStrategy ?? prev.handlingFeeStrategy,
                        codEnabled: s.codEnabled ?? prev.codEnabled,
                        onlineEnabled: s.onlineEnabled ?? prev.onlineEnabled,
                    }));
                    if (Array.isArray(s.deliveryFeeSlabs) && s.deliveryFeeSlabs.length) {
                        setDeliveryFeeSlabs(s.deliveryFeeSlabs);
                    }
                    if (Array.isArray(s.riderEarningSlabs) && s.riderEarningSlabs.length) {
                        setRiderEarningSlabs(s.riderEarningSlabs);
                    }
                    setSlabExtras((prev) => ({
                        deliveryFeeBaseWeightKg: s.deliveryFeeBaseWeightKg ?? prev.deliveryFeeBaseWeightKg,
                        deliveryFeeExtraFeePerKg: s.deliveryFeeExtraFeePerKg ?? prev.deliveryFeeExtraFeePerKg,
                        expressDeliveryEnabled: s.expressDeliveryEnabled ?? prev.expressDeliveryEnabled,
                        expressDeliveryFee: s.expressDeliveryFee ?? prev.expressDeliveryFee,
                        expressDeliveryMaxWeightKg: s.expressDeliveryMaxWeightKg ?? prev.expressDeliveryMaxWeightKg,
                        riderEarningBaseWeightKg: s.riderEarningBaseWeightKg ?? prev.riderEarningBaseWeightKg,
                        riderEarningExtraFeePerKg: s.riderEarningExtraFeePerKg ?? prev.riderEarningExtraFeePerKg,
                        riderExpressEarning: s.riderExpressEarning ?? prev.riderExpressEarning,
                        riderExtraEarningPerKmBeyondSlabs: s.riderExtraEarningPerKmBeyondSlabs ?? prev.riderExtraEarningPerKmBeyondSlabs,
                    }));
                }
            } catch (error) {
                console.error('Failed to load settings', error);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await Promise.all([
                adminApi.updatePlatformSettings({
                    returnDeliveryCommission,
                    ...commissions,
                }),
                adminApi.updateDeliveryFinanceSettings({
                    deliveryPricingMode: deliveryMode === 'fixed' ? 'fixed_price' : 'distance_based',
                    fixedDeliveryFee: config.fixedCharge,
                    minimumOrderValue: config.minimumOrderValue,
                    handlingFeeStrategy: config.handlingFeeStrategy,
                    codEnabled: config.codEnabled,
                    onlineEnabled: config.onlineEnabled,
                    deliveryFeeSlabs,
                    riderEarningSlabs,
                    ...slabExtras,
                }),
            ]);

            showToast('Delivery finance settings updated', 'success');
        } catch (error) {
            console.error('Failed to update platform settings', error);
            showToast('Failed to update fees settings', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (field, value) => {
        setConfig(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
    };

    const handleCommissionChange = (field, value) => {
        setCommissions(prev => ({ ...prev, [field]: value }));
    };

    const handleSlabExtraChange = (field, value) => {
        setSlabExtras(prev => ({ ...prev, [field]: value }));
    };

    const updateSlabField = (setter, index, field, rawValue) => {
        setter(prev => prev.map((row, i) => {
            if (i !== index) return row;
            if (field === 'maxKm' && rawValue === '') {
                return { ...row, maxKm: null };
            }
            if (field === 'freeAboveOrderValue' && rawValue === '') {
                return { ...row, freeAboveOrderValue: null };
            }
            return { ...row, [field]: parseFloat(rawValue) || 0 };
        }));
    };

    const addSlabRow = (setter, rows, valueField) => {
        const lastRow = rows[rows.length - 1];
        const nextMin = lastRow ? (lastRow.maxKm ?? lastRow.minKm + 5) : 0;
        setter(prev => [
            ...prev,
            { minKm: nextMin, maxKm: null, [valueField]: 0, ...(valueField === 'fee' ? { freeAboveOrderValue: null } : {}) },
        ]);
    };

    const removeSlabRow = (setter, index) => {
        setter(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="admin-h1 flex items-center gap-3">
                        Fees & Charges
                        <div className="p-2 bg-red-100 rounded-xl">
                            <RotateCcw className="h-5 w-5 text-red-600" />
                        </div>
                    </h1>
                    <p className="admin-description mt-1">Set up delivery fees, distance slabs, and platform commissions.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                        <History className="h-4 w-4 text-slate-400" />
                        AUDIT LOGS
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3 bg-black  text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-100 active:scale-95",
                            isSaving ? "opacity-70 cursor-wait" : "hover:bg-brand-700"
                        )}
                    >
                        {isSaving ? (
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>


            <div className="max-w-4xl mx-auto text-left">
                {/* Main Configuration Core */}
                <div className="space-y-8">
                    {/* General Financial Thresholds */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-[32px] overflow-hidden">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                <Settings className="h-4 w-4 text-slate-400" />
                                Main Charges
                            </h3>
                        </div>
                        <div className="p-8 grid grid-cols-1 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    Minimum Order Value (₹)
                                    <Info className="h-3 w-3 opacity-50" />
                                </label>
                                <div className="relative group max-w-md">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-300 group-focus-within:text-red-500 transition-colors">₹</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={config.minimumOrderValue}
                                        onChange={(e) => handleInputChange('minimumOrderValue', e.target.value)}
                                        className="w-full pl-10 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-base font-black text-slate-900 outline-none focus:ring-2 focus:ring-red-500/10 transition-all"
                                    />
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 italic">Orders below this cart value cannot be placed.</p>
                            </div>
                        </div>
                    </Card>

                    {/* Delivery Fee Settings */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-[32px] overflow-hidden">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                <Truck className="h-4 w-4 text-brand-500" />
                                Delivery Fee Settings
                            </h3>
                            <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                                <button
                                    onClick={() => setDeliveryMode('fixed')}
                                    className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", deliveryMode === 'fixed' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400")}
                                >Fixed Price</button>
                                <button
                                    onClick={() => setDeliveryMode('distance')}
                                    className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", deliveryMode === 'distance' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400")}
                                >Distance Based</button>
                            </div>
                        </div>
                        <div className="p-8">
                            {deliveryMode === 'distance' ? (
                                <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 flex gap-4">
                                    <MapPin className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-[11px] font-black text-brand-900 uppercase tracking-tight">Configured Below</p>
                                        <p className="text-[10px] font-bold text-brand-700 leading-relaxed italic">
                                            Distance-based pricing is now set per-band in the "Distance Slabs" section further down — customer fee, rider earning, weight surcharge, and Express rates. Requires Google Maps API for accurate distance; without it, the system uses straight-line distance.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <label className="text-base font-bold text-slate-900">Fixed Delivery Charge (₹)</label>
                                        <div className="relative group max-w-md">
                                            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-300 group-focus-within:text-slate-900 transition-colors">₹</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={config.fixedCharge}
                                                onChange={(e) => handleInputChange('fixedCharge', e.target.value)}
                                                className="w-full pl-10 pr-5 py-4 bg-white ring-1 ring-slate-200 border-none rounded-xl text-base font-medium text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
                                            />
                                        </div>
                                        <p className="text-sm font-medium text-slate-400">Flat fee charged for all deliveries below threshold.</p>
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 pt-6 border-t border-dashed border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Return Delivery Commission (per pickup)
                                    </label>
                                    <div className="relative group max-w-md">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-300 group-focus-within:text-slate-900 transition-colors">₹</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={returnDeliveryCommission}
                                            onChange={(e) =>
                                                setReturnDeliveryCommission(Number(e.target.value) || 0)
                                            }
                                            className="w-full pl-10 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-black text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                        />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400">
                                        Flat amount paid to delivery partner for each approved return pickup (deducted from seller earnings).
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Slab-Based Delivery Fee & Rider Earning */}
                    {deliveryMode === 'distance' && (
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-[32px] overflow-hidden text-left">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    <Bike className="h-4 w-4 text-brand-500" />
                                    Distance Slabs — Customer Fee &amp; Rider Earning
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 mt-1">
                                    Drives the actual delivery fee charged and what the delivery partner is paid. Fully editable — add, remove, or change any band anytime.
                                </p>
                            </div>
                            <div className="p-8 space-y-8">
                                {/* Customer delivery fee slabs */}
                                <div>
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-4">
                                        Customer Delivery Fee
                                    </h4>
                                    <SlabEditorTable
                                        rows={deliveryFeeSlabs}
                                        valueField="fee"
                                        valueLabel="Fee (₹)"
                                        onUpdate={(i, f, v) => updateSlabField(setDeliveryFeeSlabs, i, f, v)}
                                        onAdd={() => addSlabRow(setDeliveryFeeSlabs, deliveryFeeSlabs, 'fee')}
                                        onRemove={(i) => removeSlabRow(setDeliveryFeeSlabs, i)}
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Free weight allowance (kg)</label>
                                            <input
                                                type="number" min="0" step="0.1"
                                                value={slabExtras.deliveryFeeBaseWeightKg}
                                                onChange={(e) => handleSlabExtraChange('deliveryFeeBaseWeightKg', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                            <p className="text-[10px] font-medium text-slate-400 italic">Weight included in the base fee before surcharge kicks in.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Extra fee per kg above allowance (₹)</label>
                                            <input
                                                type="number" min="0"
                                                value={slabExtras.deliveryFeeExtraFeePerKg}
                                                onChange={(e) => handleSlabExtraChange('deliveryFeeExtraFeePerKg', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Rider earning slabs */}
                                <div className="pt-6 border-t border-slate-100">
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-4">
                                        Delivery Partner Earning
                                    </h4>
                                    <SlabEditorTable
                                        rows={riderEarningSlabs}
                                        valueField="earning"
                                        valueLabel="Earning (₹)"
                                        onUpdate={(i, f, v) => updateSlabField(setRiderEarningSlabs, i, f, v)}
                                        onAdd={() => addSlabRow(setRiderEarningSlabs, riderEarningSlabs, 'earning')}
                                        onRemove={(i) => removeSlabRow(setRiderEarningSlabs, i)}
                                    />
                                    <p className="text-[10px] font-bold text-slate-400 italic mt-2">
                                        Paid in full regardless of any customer-side discount or free-delivery promo — the platform absorbs the difference.
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Free weight allowance (kg)</label>
                                            <input
                                                type="number" min="0" step="0.1"
                                                value={slabExtras.riderEarningBaseWeightKg}
                                                onChange={(e) => handleSlabExtraChange('riderEarningBaseWeightKg', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Extra earning per kg above allowance (₹)</label>
                                            <input
                                                type="number" min="0"
                                                value={slabExtras.riderEarningExtraFeePerKg}
                                                onChange={(e) => handleSlabExtraChange('riderEarningExtraFeePerKg', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Extra earning per km beyond last band (₹)</label>
                                            <input
                                                type="number" min="0"
                                                value={slabExtras.riderExtraEarningPerKmBeyondSlabs}
                                                onChange={(e) => handleSlabExtraChange('riderExtraEarningPerKmBeyondSlabs', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                            <p className="text-[10px] font-medium text-slate-400 italic">For deliveries beyond your farthest defined band (e.g. past 15km). 0 = flat rate no matter how far.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Express delivery */}
                                <div className="pt-6 border-t border-slate-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                            <Timer className="h-4 w-4 text-amber-500" />
                                            Express Delivery (1-2 hrs)
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={() => handleSlabExtraChange('expressDeliveryEnabled', !slabExtras.expressDeliveryEnabled)}
                                            className={cn(
                                                "w-12 h-6 rounded-full p-1 transition-all duration-200 focus:outline-none",
                                                slabExtras.expressDeliveryEnabled ? "bg-black flex justify-end" : "bg-slate-200 flex justify-start"
                                            )}
                                        >
                                            <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer flat fee (₹)</label>
                                            <input
                                                type="number" min="0"
                                                value={slabExtras.expressDeliveryFee}
                                                onChange={(e) => handleSlabExtraChange('expressDeliveryFee', parseFloat(e.target.value) || 0)}
                                                disabled={!slabExtras.expressDeliveryEnabled}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 disabled:opacity-50"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rider flat earning (₹)</label>
                                            <input
                                                type="number" min="0"
                                                value={slabExtras.riderExpressEarning}
                                                onChange={(e) => handleSlabExtraChange('riderExpressEarning', parseFloat(e.target.value) || 0)}
                                                disabled={!slabExtras.expressDeliveryEnabled}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 disabled:opacity-50"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Max weight (kg)</label>
                                            <input
                                                type="number" min="0" step="0.1"
                                                value={slabExtras.expressDeliveryMaxWeightKg}
                                                onChange={(e) => handleSlabExtraChange('expressDeliveryMaxWeightKg', parseFloat(e.target.value) || 0)}
                                                disabled={!slabExtras.expressDeliveryEnabled}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 disabled:opacity-50"
                                            />
                                            <p className="text-[10px] font-medium text-slate-400 italic">Orders heavier than this fall back to standard slab pricing.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Commissions & Slab Configuration */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-[32px] overflow-hidden text-left">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                <Percent className="h-4 w-4 text-brand-500" />
                                Global Commissions & Distribution Splits
                            </h3>
                        </div>
                        <div className="p-8 space-y-8">
                            {/* Platform splits */}
                            <div>
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-slate-400" />
                                    Platform splits (Admin & System)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin commission (%)</label>
                                        <div className="relative group">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={commissions.adminCommissionPercent}
                                                onChange={(e) => handleCommissionChange('adminCommissionPercent', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Technical charge (%)</label>
                                        <div className="relative group">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={commissions.technicalChargePercent}
                                                onChange={(e) => handleCommissionChange('technicalChargePercent', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Other maintenance (%)</label>
                                        <div className="relative group">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={commissions.otherMaintenancePercent}
                                                onChange={(e) => handleCommissionChange('otherMaintenancePercent', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Operations and Network splits */}
                            <div className="pt-6 border-t border-slate-100">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Users className="h-4 w-4 text-slate-400" />
                                    Operations & Network splits
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub Admin (%)</label>
                                        <div className="relative group">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={commissions.subAdminCommissionPercent}
                                                onChange={(e) => handleCommissionChange('subAdminCommissionPercent', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Field Worker (%)</label>
                                        <div className="relative group">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={commissions.fieldWorkerCommissionPercent}
                                                onChange={(e) => handleCommissionChange('fieldWorkerCommissionPercent', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Affiliate Marketing (%)</label>
                                        <div className="relative group">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={commissions.affiliateMarketingPercent}
                                                onChange={(e) => handleCommissionChange('affiliateMarketingPercent', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Advertise (%)</label>
                                        <div className="relative group">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={commissions.advertiseChargePercent}
                                                onChange={(e) => handleCommissionChange('advertiseChargePercent', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card Membership discounts */}
                            <div className="pt-6 border-t border-slate-100">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Award className="h-4 w-4 text-slate-400" />
                                    Club Membership Discounts
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-amber-600">Gold Card Member (%)</label>
                                        <div className="relative group">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={commissions.goldCardMemberDiscountPercent}
                                                onChange={(e) => handleCommissionChange('goldCardMemberDiscountPercent', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-slate-500">Silver Card Member (%)</label>
                                        <div className="relative group">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={commissions.silverCardMemberDiscountPercent}
                                                onChange={(e) => handleCommissionChange('silverCardMemberDiscountPercent', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-amber-800">Bronze Card Member (%)</label>
                                        <div className="relative group">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={commissions.bronzeCardMemberDiscountPercent}
                                                onChange={(e) => handleCommissionChange('bronzeCardMemberDiscountPercent', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Direct Slab & Promo incentives */}
                            <div className="pt-6 border-t border-slate-100">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Megaphone className="h-4 w-4 text-slate-400" />
                                    Target Incentives & Promoting Slabs
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Direct Customer Buy Slab Commission (%)</label>
                                        <div className="relative group">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={commissions.directSlabCommissionPercent}
                                                onChange={(e) => handleCommissionChange('directSlabCommissionPercent', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                        </div>
                                        <p className="text-[10px] font-medium text-slate-400 italic">This payout is utilized for seller & vendor target achievements / incentives.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Site Cashback (%)</label>
                                        <div className="relative group">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={commissions.siteCashbackPercent}
                                                onChange={(e) => handleCommissionChange('siteCashbackPercent', parseFloat(e.target.value) || 0)}
                                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                        </div>
                                        <p className="text-[10px] font-medium text-slate-400 italic">Cashback paid by admin to users on purchases.</p>
                                    </div>
                                </div>

                                <div className="mt-6 flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">Deduct Shipping Charge Before Calculation</p>
                                        <p className="text-[10px] text-slate-500 mt-1">Calculate commissions after deducting courier/shipping costs from the product subtotal.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleCommissionChange('deductShippingBeforeCommission', !commissions.deductShippingBeforeCommission)}
                                        className={cn(
                                            "w-12 h-6 rounded-full p-1 transition-all duration-200 focus:outline-none",
                                            commissions.deductShippingBeforeCommission ? "bg-black flex justify-end" : "bg-slate-200 flex justify-start"
                                        )}
                                    >
                                        <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default BillingCharges;
