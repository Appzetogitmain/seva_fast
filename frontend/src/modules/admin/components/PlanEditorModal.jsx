import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Shield, Gift, Zap, Users, TrendingUp, ShoppingBag, Layers, Percent, Target, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';

const featureOptions = [
    { key: "FREE_DELIVERY", label: "Free Deliveries / Month", unit: "Count", icon: Zap },
    { key: "FREE_HANDLING", label: "Free Handling Fees / Month", unit: "Count", icon: Percent },
    { key: "CASHBACK", label: "Cashback Percentage", unit: "%", icon: Gift },
    { key: "VENDOR_ONBOARDING", label: "Vendor Onboarding", unit: "₹", icon: Users },
    { key: "TURNOVER_COMMISSION", label: "Turnover Commission", unit: "%", icon: TrendingUp },
    { key: "REFERRAL_LEVELS", label: "Referral Levels", unit: "Count", icon: Layers },
    { key: "LEVEL_COMMISSION", label: "Level-wise Commission", unit: "%", icon: Percent },
    { key: "MONTHLY_REFERRAL_TARGET", label: "Monthly Referral Target", unit: "Count", icon: Target },
    { key: "MONTHLY_TARGET_REWARD", label: "Monthly Target Incentive", unit: "₹", icon: Trophy },
];

const cleanNumberInput = (val) => {
    if (val === '') return '';
    // Prevent negative numbers (remove any minus sign)
    let cleaned = val.replace(/-/g, '');
    if (/^0[0-9]/.test(cleaned) && !cleaned.startsWith('0.')) {
        cleaned = cleaned.replace(/^0+/, '');
    }
    return cleaned;
};

const PlanEditorModal = ({ isOpen, onClose, plan, onSave }) => {
    const { showToast } = useToast();
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        originalPrice: '',
        description: '',
        displayColor: '#0ea5e9',
        features: [],
        validityDays: '365',
    });

    useEffect(() => {
        if (plan) {
            setFormData({
                ...plan,
                price: plan.price !== undefined && plan.price !== null ? plan.price.toString() : '',
                originalPrice: plan.originalPrice !== undefined && plan.originalPrice !== null ? plan.originalPrice.toString() : '',
                validityDays: plan.validityDays !== undefined && plan.validityDays !== null ? plan.validityDays.toString() : '365',
                features: (plan.features || []).map(f => {
                    if (f.unit === 'Boolean') return f;
                    if (f.key === 'LEVEL_COMMISSION') {
                        return { ...f, value: (Array.isArray(f.value) ? f.value : []).map(val => val !== undefined && val !== null ? val.toString() : '') };
                    }
                    return { ...f, value: f.value !== undefined && f.value !== null ? f.value.toString() : '' };
                })
            });
        } else {
            setFormData({
                name: '',
                price: '',
                originalPrice: '',
                description: '',
                displayColor: '#0ea5e9',
                features: [],
                validityDays: '365',
            });
        }
    }, [plan]);

    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('overflow-hidden');
            document.documentElement.classList.add('overflow-hidden');
        } else {
            document.body.classList.remove('overflow-hidden');
            document.documentElement.classList.remove('overflow-hidden');
        }
        return () => {
            document.body.classList.remove('overflow-hidden');
            document.documentElement.classList.remove('overflow-hidden');
        };
    }, [isOpen]);

    const handleToggleFeature = (feature) => {
        const exists = formData.features.find(f => f.key === feature.key);
        if (exists) {
            setFormData(prev => ({
                ...prev,
                features: prev.features.filter(f => f.key !== feature.key)
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                features: [...prev.features, {
                    key: feature.key,
                    label: feature.label,
                    unit: feature.unit,
                    value: feature.key === 'LEVEL_COMMISSION' ? [] : (feature.unit === 'Boolean' ? true : '')
                }]
            }));
        }
    };

    const handleRemoveFeature = (key) => {
        setFormData(prev => ({
            ...prev,
            features: prev.features.filter(f => f.key !== key)
        }));
    };

    const handleFeatureValueChange = (key, value) => {
        setFormData(prev => ({
            ...prev,
            features: prev.features.map(f => f.key === key ? { ...f, value } : f)
        }));
    };

    const handleSubmit = () => {
        if (!formData.name.trim()) return showToast('Plan name is required', 'error');
        if (formData.price === '') return showToast('Plan price is required', 'error');
        if (formData.validityDays === '') return showToast('Validity (days) is required', 'error');

        const cleanedData = {
            ...formData,
            price: formData.price === '' ? 0 : parseFloat(formData.price),
            originalPrice: formData.originalPrice === '' ? undefined : parseFloat(formData.originalPrice),
            validityDays: formData.validityDays === '' ? 365 : parseInt(formData.validityDays),
            features: formData.features.map(f => {
                if (f.unit === 'Boolean') {
                    return f;
                }
                if (f.key === 'LEVEL_COMMISSION') {
                    const parsedArray = (Array.isArray(f.value) ? f.value : []).map(val => 
                        val === '' ? 0 : parseFloat(val)
                    );
                    return { ...f, value: parsedArray };
                }
                return { ...f, value: f.value === '' ? 0 : parseFloat(f.value) };
            })
        };
        onSave(cleanedData);
    };

    if (!isOpen) return null;

    return (
        <div 
            onClick={onClose}
            data-lenis-prevent 
            className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto"
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                data-lenis-prevent 
                className="bg-white rounded-[40px] w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden relative"
            >
                <div className="w-full flex flex-col overflow-y-auto overscroll-contain custom-scrollbar">
                <style dangerouslySetInnerHTML={{ __html: `
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 6px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: #e2e8f0;
                        border-radius: 10px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: #cbd5e1;
                    }
                `}} />

                {/* Header */}
                <div className="sticky top-0 bg-white/95 backdrop-blur-md p-8 border-b border-slate-100 flex items-center justify-between z-20">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">{plan ? 'Edit Plan' : 'Create New Plan'}</h2>
                        <p className="text-sm font-bold text-slate-400">Configure your dynamic subscription plan.</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                        <X className="h-5 w-5 text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 p-8 space-y-8">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Gold Plus"
                                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500/10"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Offer Price (₹)</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={formData.price}
                                onChange={(e) => {
                                    setFormData({ ...formData, price: cleanNumberInput(e.target.value) });
                                }}
                                placeholder="0"
                                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500/10"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Strike Price (₹)</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={formData.originalPrice}
                                onChange={(e) => {
                                    setFormData({ ...formData, originalPrice: cleanNumberInput(e.target.value) });
                                }}
                                placeholder="e.g. 1999"
                                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500/10"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500/10 resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Display Color</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="color"
                                    value={formData.displayColor}
                                    onChange={(e) => setFormData({ ...formData, displayColor: e.target.value })}
                                    className="h-12 w-20 rounded-xl cursor-pointer bg-transparent"
                                />
                                <input
                                    type="text"
                                    value={formData.displayColor}
                                    onChange={(e) => setFormData({ ...formData, displayColor: e.target.value })}
                                    className="flex-1 px-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-mono font-bold"
                                />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Validity (Days)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={formData.validityDays}
                                onChange={(e) => {
                                    setFormData({ ...formData, validityDays: cleanNumberInput(e.target.value) });
                                }}
                                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500/10"
                            />
                        </div>
                    </div>

                    {/* Features Builder */}
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Features & Permissions</h3>
                            <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                                {featureOptions.map((opt) => {
                                    const isSelected = formData.features.some(f => f.key === opt.key);
                                    return (
                                        <button
                                            key={opt.key}
                                            onClick={() => handleToggleFeature(opt)}
                                            className={cn(
                                                "p-2 rounded-xl transition-all",
                                                isSelected
                                                    ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                                                    : "bg-slate-50 text-slate-500 hover:bg-slate-200"
                                            )}
                                            title={opt.label}
                                        >
                                            <opt.icon className="h-4 w-4" />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {formData.features.length === 0 ? (
                                <div className="p-8 border-2 border-dashed border-slate-100 rounded-[32px] text-center">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No features added. Click icons above to add.</p>
                                </div>
                            ) : (
                                formData.features.map((feature, idx) => (
                                    <div key={idx} className="flex items-center gap-4 p-5 bg-slate-50 rounded-[24px]">
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{feature.label}</p>
                                            <div className="flex items-center gap-4">
                                                {feature.unit === 'Boolean' ? (
                                                    <button
                                                        onClick={() => handleFeatureValueChange(feature.key, !feature.value)}
                                                        className={cn(
                                                            "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                            feature.value ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                                                        )}
                                                    >
                                                        {feature.value ? 'Enabled' : 'Disabled'}
                                                    </button>
                                                ) : feature.key === 'LEVEL_COMMISSION' ? (
                                                    <div className="w-full space-y-2">
                                                        {(() => {
                                                            const levelsFeature = formData.features.find(f => f.key === 'REFERRAL_LEVELS');
                                                            const numLevels = levelsFeature ? (parseInt(levelsFeature.value) || 0) : 0;
                                                            if (numLevels <= 0) {
                                                                return <p className="text-xs text-red-500 font-bold">Please set 'Referral Levels' first.</p>;
                                                            }
                                                            const values = Array.isArray(feature.value) ? feature.value : [];
                                                            return Array.from({ length: numLevels }).map((_, i) => (
                                                                <div key={i} className="relative flex items-center gap-2">
                                                                    <span className="text-[10px] font-black text-slate-500 uppercase w-12">Lvl {i + 1}</span>
                                                                    <div className="relative flex-1">
                                                                        <input
                                                                            type="text"
                                                                            inputMode="decimal"
                                                                            value={values[i] !== undefined ? values[i] : ''}
                                                                            onChange={(e) => {
                                                                                const cleaned = cleanNumberInput(e.target.value);
                                                                                const newValues = [...values];
                                                                                newValues[i] = cleaned;
                                                                                handleFeatureValueChange(feature.key, newValues);
                                                                            }}
                                                                            className="w-full pl-4 pr-10 py-2 bg-white border-none rounded-xl text-sm font-bold outline-none"
                                                                        />
                                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-300">{feature.unit}</span>
                                                                    </div>
                                                                </div>
                                                            ));
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <div className="relative flex-1">
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={feature.value !== undefined ? feature.value : ''}
                                                            onChange={(e) => {
                                                                const cleaned = cleanNumberInput(e.target.value);
                                                                handleFeatureValueChange(feature.key, cleaned);
                                                            }}
                                                            className="w-full pl-4 pr-10 py-2 bg-white border-none rounded-xl text-sm font-bold outline-none"
                                                        />
                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-300">{feature.unit}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveFeature(feature.key)}
                                            className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 p-8 border-t border-slate-100 bg-slate-50/95 backdrop-blur-md z-20 mt-auto">
                    <button
                        onClick={handleSubmit}
                        className="w-full py-5 bg-black text-white rounded-[24px] text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all"
                    >
                        {plan ? 'Save Changes' : 'Create Plan'}
                    </button>
                </div>
                </div>
            </div>
        </div>
    );
};

export default PlanEditorModal;
