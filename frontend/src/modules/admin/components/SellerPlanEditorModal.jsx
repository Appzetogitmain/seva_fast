import React, { useState, useEffect } from 'react';
import Modal from '@shared/components/ui/Modal';
import { Plus, Trash2, Sparkles, CheckCircle2, ShieldCheck, Clock } from 'lucide-react';

const SellerPlanEditorModal = ({ isOpen, onClose, onSave, plan }) => {
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        originalPrice: '',
        validityDays: '30',
        description: '',
        badgeText: '',
        displayColor: '#0ea5e9',
        isActive: true,
        features: ['0% Commission on all orders', 'Unlimited Order Acceptances', 'Priority Store Search Listing'],
    });

    const [newFeature, setNewFeature] = useState('');

    useEffect(() => {
        if (plan) {
            setFormData({
                name: plan.name || '',
                price: plan.price !== undefined ? plan.price : '',
                originalPrice: plan.originalPrice !== undefined ? plan.originalPrice : '',
                validityDays: plan.validityDays || '30',
                description: plan.description || '',
                badgeText: plan.badgeText || '',
                displayColor: plan.displayColor || '#0ea5e9',
                isActive: plan.isActive !== undefined ? plan.isActive : true,
                features: Array.isArray(plan.features) ? plan.features : [],
            });
        } else {
            setFormData({
                name: '',
                price: '',
                originalPrice: '',
                validityDays: '30',
                description: '',
                badgeText: '',
                displayColor: '#0ea5e9',
                isActive: true,
                features: ['0% Commission on all orders', 'Unlimited Order Acceptances', 'Priority Store Search Listing'],
            });
        }
    }, [plan, isOpen]);

    const handleAddFeature = () => {
        if (!newFeature.trim()) return;
        setFormData(prev => ({
            ...prev,
            features: [...prev.features, newFeature.trim()]
        }));
        setNewFeature('');
    };

    const handleRemoveFeature = (index) => {
        setFormData(prev => ({
            ...prev,
            features: prev.features.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || formData.price === '' || !formData.validityDays) {
            return;
        }

        onSave({
            ...formData,
            price: Number(formData.price),
            originalPrice: formData.originalPrice !== '' ? Number(formData.originalPrice) : undefined,
            validityDays: Number(formData.validityDays),
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={plan ? "Edit Seller Subscription Plan" : "Create Seller Subscription Plan"}>
            <form onSubmit={handleSubmit} className="space-y-6 pt-2 font-['Outfit']">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-2">Plan Name *</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Pro Seller 90 Days"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-2">Validity Days *</label>
                        <div className="relative">
                            <input
                                type="number"
                                required
                                min="1"
                                placeholder="30"
                                value={formData.validityDays}
                                onChange={(e) => setFormData({ ...formData, validityDays: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                            />
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        </div>
                    </div>
                </div>

                {/* Price Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-2">Selling Price (₹) *</label>
                        <input
                            type="number"
                            required
                            min="0"
                            placeholder="999"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-2">Original Price (₹) (Optional)</label>
                        <input
                            type="number"
                            min="0"
                            placeholder="1499"
                            value={formData.originalPrice}
                            onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                        />
                    </div>
                </div>

                {/* Badge & Color */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-2">Badge Text (Optional)</label>
                        <input
                            type="text"
                            placeholder="e.g. POPULAR, BEST VALUE"
                            value={formData.badgeText}
                            onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-2">Display Color</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={formData.displayColor}
                                onChange={(e) => setFormData({ ...formData, displayColor: e.target.value })}
                                className="h-11 w-16 rounded-xl border border-slate-200 p-1 cursor-pointer bg-slate-50"
                            />
                            <span className="text-xs font-mono font-bold text-slate-600">{formData.displayColor}</span>
                        </div>
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-2">Description</label>
                    <textarea
                        rows={2}
                        placeholder="Brief summary of seller benefits under this plan..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10 resize-none"
                    />
                </div>

                {/* Features List */}
                <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-2">Key Features Highlights</label>
                    <div className="flex items-center gap-2 mb-3">
                        <input
                            type="text"
                            placeholder="Add feature e.g. Priority Support"
                            value={newFeature}
                            onChange={(e) => setNewFeature(e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none"
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature(); } }}
                        />
                        <button
                            type="button"
                            onClick={handleAddFeature}
                            className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all flex items-center gap-1"
                        >
                            <Plus className="h-4 w-4" /> Add
                        </button>
                    </div>
                    <div className="space-y-2 max-h-36 overflow-y-auto">
                        {formData.features.map((ft, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold text-slate-700">
                                <span className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                    {ft}
                                </span>
                                <button type="button" onClick={() => handleRemoveFeature(idx)} className="text-rose-500 hover:text-rose-700 p-1">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                        <p className="text-xs font-bold text-slate-900">Plan Status</p>
                        <p className="text-[10px] text-slate-500">In-active plans won't be visible to sellers.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            formData.isActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                    >
                        {formData.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-8 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                    >
                        {plan ? "Save Changes" : "Create Plan"}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default SellerPlanEditorModal;
