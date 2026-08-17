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
    const [savingType, setSavingType] = useState(null);

    const fetchAll = async () => {
        try {
            setIsLoading(true);
            const [templatesRes, statusRes] = await Promise.all([
                adminApi.getWhatsAppTemplates(),
                adminApi.getWhatsAppConfigStatus(),
            ]);
            if (templatesRes.data.success) setTemplates(templatesRes.data.result || []);
            if (statusRes.data.success) setConfigStatus(statusRes.data.result);
        } catch (error) {
            showToast(error?.response?.data?.message || 'Failed to load WhatsApp templates', 'error');
        } finally {
            setIsLoading(false);
        }
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
