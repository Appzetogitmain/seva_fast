import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Download, MessageCircle, Send, Smartphone, X } from 'lucide-react';
import { toast } from 'sonner';

// Share helper for places where the native share sheet may be missing.
// Android WebViews (our Flutter app) have no navigator.share, so instead of
// silently copying a bare link we show our own sheet with share targets.

const isFlutterApp = () => typeof window !== 'undefined' && Boolean(window.Flutter);

const openExternal = (href) => {
    // In the Flutter WebView, a new window lets the wrapper hand the link to
    // the OS (WhatsApp / SMS app). In a browser this opens a new tab/app.
    const win = window.open(href, '_blank', 'noopener');
    if (!win) window.location.href = href;
};

const copyText = async (value) => {
    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch {
        // Older WebViews: fall back to a temporary textarea.
        try {
            const ta = document.createElement('textarea');
            ta.value = value;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch {
            return false;
        }
    }
};

const downloadFile = (file) => {
    const href = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = href;
    link.download = file.name || 'share.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(href), 1500);
};

/**
 * const { share, sheet } = useShareSheet();
 * share({ title, text, url, file? })  — then render {sheet} once in the page.
 */
export const useShareSheet = () => {
    const [payload, setPayload] = useState(null);

    const share = useCallback(async ({ title, text = '', url = '', file = null }) => {
        try {
            if (file && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ title, text: [text, url].filter(Boolean).join(' '), files: [file] });
                return;
            }
            if (navigator.share && !isFlutterApp()) {
                await navigator.share({ title, text, url });
                return;
            }
        } catch (error) {
            if (error?.name === 'AbortError') return; // user closed the native sheet
        }
        setPayload({ title, text, url, file });
    }, []);

    const sheet = <ShareSheet payload={payload} onClose={() => setPayload(null)} />;
    return { share, sheet };
};

const ShareSheet = ({ payload, onClose }) => {
    const { t } = useTranslation('customer');
    const message = payload ? [payload.text, payload.url].filter(Boolean).join(' ') : '';
    const encoded = encodeURIComponent(message);

    const targets = payload
        ? [
              {
                  key: 'whatsapp',
                  label: 'WhatsApp',
                  icon: MessageCircle,
                  className: 'bg-emerald-500 text-white',
                  onClick: () => openExternal(`https://api.whatsapp.com/send?text=${encoded}`),
              },
              {
                  key: 'telegram',
                  label: 'Telegram',
                  icon: Send,
                  className: 'bg-sky-500 text-white',
                  onClick: () =>
                      openExternal(
                          `https://t.me/share/url?url=${encodeURIComponent(payload.url || '')}&text=${encodeURIComponent(payload.text || '')}`,
                      ),
              },
              {
                  key: 'sms',
                  label: t('profile.shareSheet.sms', { defaultValue: 'SMS' }),
                  icon: Smartphone,
                  className: 'bg-slate-700 text-white',
                  onClick: () => openExternal(`sms:?body=${encoded}`),
              },
          ]
        : [];

    const handleCopy = async () => {
        const ok = await copyText(message);
        if (ok) {
            toast.success(t('profile.shareSheet.copied', { defaultValue: 'Message with link copied' }));
            onClose();
        } else {
            toast.error(payload?.url || message);
        }
    };

    return (
        <AnimatePresence>
            {payload && (
                <motion.div
                    className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 sm:items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={t('profile.shareSheet.title', { defaultValue: 'Share' })}
                        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
                        initial={{ y: 40 }}
                        animate={{ y: 0 }}
                        exit={{ y: 40 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-base font-black text-slate-900">
                                {payload.title || t('profile.shareSheet.title', { defaultValue: 'Share' })}
                            </h3>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
                                aria-label={t('common:actions.close', { defaultValue: 'Close' })}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <p className="mb-4 break-words rounded-2xl bg-slate-50 p-3 text-xs font-medium text-slate-600">
                            {message}
                        </p>

                        <div className="mb-3 grid grid-cols-3 gap-3">
                            {targets.map(({ key, label, icon: Icon, className, onClick }) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={onClick}
                                    className="flex flex-col items-center gap-1.5 rounded-2xl p-2 hover:bg-slate-50"
                                >
                                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${className}`}>
                                        <Icon size={22} />
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-700">{label}</span>
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={handleCopy}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800"
                        >
                            <Copy size={16} />
                            {t('profile.shareSheet.copy', { defaultValue: 'Copy message with link' })}
                        </button>

                        {payload.file && !isFlutterApp() && (
                            <button
                                type="button"
                                onClick={() => downloadFile(payload.file)}
                                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                            >
                                <Download size={16} />
                                {t('profile.shareSheet.saveImage', { defaultValue: 'Save card image' })}
                            </button>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ShareSheet;
