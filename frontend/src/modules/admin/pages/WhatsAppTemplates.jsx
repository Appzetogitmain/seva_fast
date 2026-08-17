import React, { useEffect, useMemo, useState } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import PageHeader from '@shared/components/ui/PageHeader';
import { useToast } from '@shared/components/ui/Toast';
import { HiOutlineChatBubbleLeftRight, HiOutlineExclamationTriangle, HiOutlineArrowPath } from 'react-icons/hi2';
import { adminApi } from '../services/adminApi';

const SOURCE_VARIANT = {
    database: 'success',
    env: 'warning',
    default: 'gray',
};

const SOURCE_LABEL = {
    database: 'Customized',
    env: 'Env override',
    default: 'Default',
};

const SAMPLE_VARS = {
    name: 'Priya',
    orderNumber: 'ORD10234',
    amount: 'Rs. 1,249',
    status: 'cancelled',
    direction: 'credited to',
    reason: 'Return refund for order #ORD10234',
    balance: 'Rs. 2,499',
    planName: 'Gold',
    validityDays: '365',
    expiryDate: '17 Aug 2027',
    features: 'Free Delivery, 5% Cashback',
};

function renderPreview(text) {
    return text.replace(/\{(\w+)\}/g, (match, key) => (SAMPLE_VARS[key] !== undefined ? SAMPLE_VARS[key] : match));
}

const TemplateCard = ({ template, onSave, onReset, savingType }) => {
    const [text, setText] = useState(template.text);
    const isDirty = text !== template.text;
    const isSaving = savingType === template.messageType;

    useEffect(() => {
        setText(template.text);
    }, [template.text]);

    return (
        <Card className="ds-card-standard space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="ds-h4 text-slate-900">{template.label}</h3>
                    <p className="ds-caption text-slate-400 mt-0.5">
                        Variables: {template.variables.map((v) => `{${v}}`).join(', ')}
                    </p>
                    {template.messageType === 'birthday_wish' && (
                        <p className="ds-caption text-slate-400 mt-0.5">
                            If a Birthday Coupon Template is configured under Coupons &amp; Promos, a gift line with
                            that customer's unique code is appended automatically — no placeholder needed here.
                        </p>
                    )}
                </div>
                <Badge variant={SOURCE_VARIANT[template.source] || 'gray'} className="text-[9px] font-black uppercase">
                    {SOURCE_LABEL[template.source] || template.source}
                </Badge>
            </div>

            <textarea
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="ds-textarea w-full resize-none"
                maxLength={1024}
            />

            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Preview</p>
                <p className="ds-body text-slate-700">{renderPreview(text)}</p>
            </div>

            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={() => onReset(template.messageType)}
                    disabled={template.source !== 'database' || isSaving}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 disabled:opacity-30 disabled:hover:text-slate-400"
                >
                    <HiOutlineArrowPath className="h-3.5 w-3.5" />
                    Reset to Default
                </button>
                <button
                    type="button"
                    onClick={() => onSave(template.messageType, text)}
                    disabled={!isDirty || !text.trim() || isSaving}
                    className="ds-btn ds-btn-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40"
                >
                    {isSaving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </Card>
    );
};

const WhatsAppTemplates = () => {
    const { showToast } = useToast();
    const [configStatus, setConfigStatus] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [savingType, setSavingType] = useState(null);

    const fetchAll = async () => {
        setIsLoading(true);
        setLoadError('');

        // Independent settles — templates and config-status are unrelated;
        // one failing must never blank out data the other already fetched.
        const [templatesResult, statusResult] = await Promise.allSettled([
            adminApi.getWhatsAppTemplates(),
            adminApi.getWhatsAppConfigStatus(),
        ]);

        if (templatesResult.status === 'fulfilled' && templatesResult.value.data.success) {
            // handleResponse (backend/app/utils/helper.js) puts array payloads under
            // `results` (plural) and object payloads under `result` (singular) —
            // listEffectiveTemplates() returns an array, so it's `results` here.
            setTemplates(templatesResult.value.data.results || []);
        } else if (templatesResult.status === 'rejected') {
            const message = templatesResult.reason?.response?.data?.message || 'Failed to load WhatsApp templates';
            setLoadError(message);
            showToast(message, 'error');
        }

        if (statusResult.status === 'fulfilled' && statusResult.value.data.success) {
            setConfigStatus(statusResult.value.data.result);
        } else if (statusResult.status === 'rejected') {
            showToast(statusResult.reason?.response?.data?.message || 'Failed to load WhatsApp config status', 'error');
        }

        setIsLoading(false);
    };

    useEffect(() => {
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSave = async (messageType, text) => {
        try {
            setSavingType(messageType);
            await adminApi.updateWhatsAppTemplate(messageType, { text });
            showToast('Template saved', 'success');
            await fetchAll();
        } catch (error) {
            showToast(error?.response?.data?.message || 'Failed to save template', 'error');
        } finally {
            setSavingType(null);
        }
    };

    const handleReset = async (messageType) => {
        try {
            setSavingType(messageType);
            await adminApi.resetWhatsAppTemplate(messageType);
            showToast('Template reset to default', 'success');
            await fetchAll();
        } catch (error) {
            showToast(error?.response?.data?.message || 'Failed to reset template', 'error');
        } finally {
            setSavingType(null);
        }
    };

    const configWarning = useMemo(() => {
        if (!configStatus) return null;
        if (!configStatus.enabled) {
            return 'WhatsApp sending is currently disabled (WHATSAPP_ENABLED=false). Templates below are editable, but no messages will send until it is enabled.';
        }
        if (!configStatus.configured) {
            return 'WhatsApp is enabled but not fully configured (missing Tezsender API key). Sends will fail until it is set.';
        }
        return null;
    }, [configStatus]);

    return (
        <div className="ds-section-spacing">
            <PageHeader
                title="WhatsApp Templates"
                description="Edit the automated messages sent for order events and birthdays. Changes apply immediately, no redeploy needed."
                badge={
                    <Badge variant="success" className="ds-badge ds-badge-success">
                        Tezsender
                    </Badge>
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

            {loadError && (
                <Card className="ds-card-compact bg-rose-50 border-rose-100">
                    <div className="flex gap-3 items-start justify-between">
                        <div className="flex gap-3 items-start">
                            <HiOutlineExclamationTriangle className="ds-icon-lg text-rose-600 flex-shrink-0" />
                            <p className="ds-body text-rose-800">{loadError}</p>
                        </div>
                        <button
                            type="button"
                            onClick={fetchAll}
                            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-rose-700 hover:text-rose-900 shrink-0"
                        >
                            <HiOutlineArrowPath className="h-3.5 w-3.5" />
                            Retry
                        </button>
                    </div>
                </Card>
            )}

            {isLoading && templates.length === 0 && (
                <Card className="ds-card-standard">
                    <div className="text-center py-12">
                        <div className="h-16 w-16 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <HiOutlineChatBubbleLeftRight className="h-8 w-8 text-slate-200" />
                        </div>
                        <p className="ds-caption text-slate-400">Loading templates...</p>
                    </div>
                </Card>
            )}

            {!isLoading && !loadError && templates.length === 0 && (
                <Card className="ds-card-standard">
                    <div className="text-center py-12">
                        <p className="ds-caption text-slate-400">No templates found.</p>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {templates.map((template) => (
                    <TemplateCard
                        key={template.messageType}
                        template={template}
                        onSave={handleSave}
                        onReset={handleReset}
                        savingType={savingType}
                    />
                ))}
            </div>
        </div>
    );
};

export default WhatsAppTemplates;
