import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Phone,
    MessageCircle,
    Globe,
    MapPin,
    Share2,
    Check,
    AlertCircle,
    Loader2,
    X,
    ChevronLeft,
    ChevronRight,
    ChevronRight as RowArrow,
    BadgeCheck,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { useToast } from '@shared/components/ui/Toast';
import { trackAdInteraction } from '../../../core/utils/analyticsTracker';

const toWebUrl = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
const displayUrl = (url) => url.replace(/^https?:\/\//i, '').replace(/\/$/, '');

/** One row of the contact list, styled like an app settings row. */
const ContactRow = ({ icon: Icon, iconClass, label, value, href, external, onClick }) => {
    const content = (
        <>
            <span className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${iconClass}`}>
                <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium text-slate-500">{label}</span>
                <span className="block text-sm font-semibold text-slate-900 truncate">{value}</span>
            </span>
            {href && <RowArrow className="h-4 w-4 text-slate-300 shrink-0" />}
        </>
    );
    const cls = 'flex items-center gap-3 px-4 py-3';
    if (!href) return <div className={cls}>{content}</div>;
    return (
        <a
            href={href}
            onClick={onClick}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className={`${cls} active:bg-slate-50 transition-colors`}
        >
            {content}
        </a>
    );
};

const PromotionDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [ad, setAd] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const galleryRef = useRef(null);
    const videoRefs = useRef({});
    const [activeIndex, setActiveIndex] = useState(0);
    const [isMuted, setIsMuted] = useState(true);
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchAd = async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await customerApi.getPlatformAdById(id);
                if (!isMounted) return;
                const foundAd = res.data?.result;
                if (foundAd) {
                    setAd(foundAd);
                    if (foundAd._id) {
                        trackAdInteraction({ targetType: 'PlatformAd', targetId: foundAd._id, interactionType: 'visit' });
                    }
                } else {
                    setError('This promotion is no longer available.');
                }
            } catch (err) {
                if (isMounted) setError(err.response?.data?.message || 'Unable to load this promotion.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        if (id) fetchAd();
        return () => {
            isMounted = false;
        };
    }, [id]);

    // Videos first, then photos — all in one swipeable gallery.
    const media = useMemo(() => {
        if (!ad) return [];
        const videos = Array.isArray(ad.videos) && ad.videos.length > 0
            ? ad.videos
            : (ad.videoUrl ? [ad.videoUrl] : (ad.mediaUrl && ad.mediaType === 'video' ? [ad.mediaUrl] : []));
        const posters = Array.isArray(ad.posters) && ad.posters.length > 0
            ? ad.posters
            : (ad.imageUrl ? [ad.imageUrl] : (ad.mediaUrl && ad.mediaType === 'image' ? [ad.mediaUrl] : []));
        return [
            ...videos.filter(Boolean).map((src) => ({ type: 'video', src })),
            ...posters.filter(Boolean).map((src) => ({ type: 'image', src })),
        ];
    }, [ad]);

    const images = useMemo(() => media.filter((m) => m.type === 'image'), [media]);

    // Only the visible video plays.
    useEffect(() => {
        Object.entries(videoRefs.current).forEach(([idx, el]) => {
            if (!el) return;
            if (Number(idx) === activeIndex) el.play().catch(() => {});
            else el.pause();
        });
    }, [activeIndex, media]);

    const handleGalleryScroll = () => {
        const el = galleryRef.current;
        if (!el || !el.clientWidth) return;
        const idx = Math.round(el.scrollLeft / el.clientWidth);
        if (idx !== activeIndex) setActiveIndex(Math.max(0, Math.min(media.length - 1, idx)));
    };

    const goToSlide = (idx) => {
        const el = galleryRef.current;
        if (!el) return;
        const target = (idx + media.length) % media.length;
        el.scrollTo({ left: target * el.clientWidth, behavior: 'smooth' });
    };

    const toggleMute = (e) => {
        e.stopPropagation();
        const next = !isMuted;
        setIsMuted(next);
        Object.values(videoRefs.current).forEach((el) => {
            if (el) el.muted = next;
        });
    };

    const openLightbox = (mediaIdx) => {
        const imgIdx = images.findIndex((img) => img.src === media[mediaIdx]?.src);
        if (imgIdx >= 0) setLightboxIndex(imgIdx);
    };

    const stepLightbox = useCallback(
        (dir) => setLightboxIndex((prev) => (prev === null ? prev : (prev + dir + images.length) % images.length)),
        [images.length]
    );

    useEffect(() => {
        if (lightboxIndex === null) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') setLightboxIndex(null);
            if (e.key === 'ArrowRight') stepLightbox(1);
            if (e.key === 'ArrowLeft') stepLightbox(-1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightboxIndex, stepLightbox]);

    // navigate(-1) does nothing when this page was opened directly (shared
    // link, new tab, notification) because there is no in-app history entry.
    // React Router stores the history position in history.state.idx.
    const handleBack = () => {
        const idx = window.history.state?.idx;
        if (typeof idx === 'number' && idx > 0) navigate(-1);
        else navigate('/', { replace: true });
    };

    const handleShare = async () => {
        const shareData = {
            title: ad?.businessName || ad?.title || 'SevaFast',
            text: ad?.title || 'View this offer on SevaFast.',
            url: window.location.href,
        };
        if (navigator.share) {
            try {
                await navigator.share(shareData);
                return;
            } catch (err) {
                if (err?.name === 'AbortError') return;
            }
        }
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            showToast('Link copied', 'success');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            showToast('Could not copy link', 'error');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="h-7 w-7 text-slate-400 animate-spin" />
            </div>
        );
    }

    if (error || !ad) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 text-center">
                <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <AlertCircle className="h-7 w-7 text-slate-400" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Promotion unavailable</h2>
                <p className="text-sm text-slate-500 mt-1 mb-6">{error || 'This promotion is no longer active.'}</p>
                <button
                    onClick={() => navigate('/')}
                    className="px-6 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-95 transition"
                >
                    Go to Home
                </button>
            </div>
        );
    }

    const businessName = ad.businessName || ad.title;
    const showSubtitle = ad.businessName && ad.title && ad.businessName !== ad.title;
    const contactPhone = ad.contactPhone || ad.owner?.phone || '';
    const whatsappDigits = (ad.whatsapp || contactPhone || '').replace(/[^0-9]/g, '');
    const whatsappNumber = whatsappDigits.length === 10 ? `91${whatsappDigits}` : whatsappDigits;
    const whatsappHref = whatsappNumber
        ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hello, I saw your offer "${ad.title}" on SevaFast and would like to know more.`)}`
        : '';
    const website = (ad.targetUrl || '').trim();
    const fullAddress = [ad.address, ad.city].filter(Boolean).join(', ');
    const content = (ad.content || '').trim();
    const isLongContent = content.length > 260;

    const track = (interactionType) => () =>
        trackAdInteraction({ targetType: 'PlatformAd', targetId: ad._id, interactionType });

    const hasActions = Boolean(contactPhone || whatsappHref);

    return (
        <div className="min-h-screen bg-slate-100">
            <div className={`mx-auto max-w-md min-h-screen bg-slate-50 ${hasActions ? 'pb-24' : 'pb-6'}`}>
                {/* App bar */}
                <header className="sticky top-0 z-30 flex items-center gap-2 h-14 px-2 bg-white/95 backdrop-blur border-b border-slate-100">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="h-10 w-10 rounded-full flex items-center justify-center text-slate-800 active:bg-slate-100"
                        aria-label="Back"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <h1 className="flex-1 min-w-0 text-[15px] font-semibold text-slate-900 truncate">{businessName}</h1>
                    <button
                        onClick={handleShare}
                        className="h-10 w-10 rounded-full flex items-center justify-center text-slate-800 active:bg-slate-100"
                        aria-label="Share"
                    >
                        {copied ? <Check className="h-5 w-5 text-emerald-600" /> : <Share2 className="h-5 w-5" />}
                    </button>
                </header>

                {/* Gallery */}
                {media.length > 0 && (
                    <section className="relative bg-slate-900">
                        <div
                            ref={galleryRef}
                            onScroll={handleGalleryScroll}
                            className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
                        >
                            {media.map((item, idx) => (
                                <div
                                    key={`${item.type}-${idx}`}
                                    className="relative w-full shrink-0 snap-center aspect-square overflow-hidden"
                                    onClick={() => item.type === 'image' && openLightbox(idx)}
                                >
                                    {item.type === 'image' ? (
                                        <>
                                            {/* Blurred fill so the full image fits without grey bars or cropping */}
                                            <img
                                                src={item.src}
                                                alt=""
                                                aria-hidden="true"
                                                className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl opacity-60"
                                            />
                                            <img
                                                src={item.src}
                                                alt={`${businessName} ${idx + 1}`}
                                                loading={idx === 0 ? 'eager' : 'lazy'}
                                                className="relative h-full w-full object-contain"
                                            />
                                        </>
                                    ) : (
                                        <video
                                            ref={(el) => {
                                                videoRefs.current[idx] = el;
                                            }}
                                            src={item.src}
                                            autoPlay={idx === 0}
                                            loop
                                            muted={isMuted}
                                            playsInline
                                            disablePictureInPicture
                                            controls={false}
                                            controlsList="nodownload nofullscreen noremoteplayback"
                                            className="h-full w-full object-contain bg-black"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        {media[activeIndex]?.type === 'video' && (
                            <button
                                type="button"
                                onClick={toggleMute}
                                className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-black/55 text-white flex items-center justify-center backdrop-blur"
                                aria-label={isMuted ? 'Unmute' : 'Mute'}
                            >
                                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                            </button>
                        )}

                        {media.length > 1 && (
                            <>
                                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/55 text-white text-[11px] font-medium backdrop-blur">
                                    {activeIndex + 1}/{media.length}
                                </span>
                                <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5 pointer-events-none">
                                    {media.map((_, idx) => (
                                        <span
                                            key={idx}
                                            className={`h-1.5 rounded-full transition-all ${idx === activeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
                                        />
                                    ))}
                                </div>
                                {/* Arrows for mouse users; hidden on touch-size screens */}
                                <button
                                    type="button"
                                    onClick={() => goToSlide(activeIndex - 1)}
                                    className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/85 text-slate-900 items-center justify-center shadow"
                                    aria-label="Previous"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => goToSlide(activeIndex + 1)}
                                    className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/85 text-slate-900 items-center justify-center shadow"
                                    aria-label="Next"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </>
                        )}
                    </section>
                )}

                {/* Title block */}
                <section className="bg-white px-4 pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-medium text-slate-600">Sponsored</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                            <BadgeCheck className="h-3.5 w-3.5" />
                            Approved by SevaFast
                        </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 leading-snug">{businessName}</h2>
                    {showSubtitle && <p className="text-sm text-slate-600 mt-0.5">{ad.title}</p>}
                    {ad.city && (
                        <p className="mt-2 inline-flex items-center gap-1 text-[13px] text-slate-500">
                            <MapPin className="h-3.5 w-3.5" />
                            {ad.city}
                        </p>
                    )}
                </section>

                {/* About */}
                {content && (
                    <section className="bg-white mt-2 px-4 py-4">
                        <h3 className="text-sm font-semibold text-slate-900 mb-2">About this offer</h3>
                        <p
                            className={`text-sm text-slate-700 leading-relaxed whitespace-pre-line ${
                                isLongContent && !expanded ? 'line-clamp-5' : ''
                            }`}
                        >
                            {content}
                        </p>
                        {isLongContent && (
                            <button
                                type="button"
                                onClick={() => setExpanded((v) => !v)}
                                className="mt-1 text-sm font-semibold text-brand-600"
                            >
                                {expanded ? 'Show less' : 'Read more'}
                            </button>
                        )}
                    </section>
                )}

                {/* Contact */}
                {(contactPhone || whatsappHref || website || fullAddress) && (
                    <section className="bg-white mt-2">
                        <h3 className="px-4 pt-4 pb-1 text-sm font-semibold text-slate-900">Contact</h3>
                        <div className="divide-y divide-slate-100">
                            {contactPhone && (
                                <ContactRow
                                    icon={Phone}
                                    iconClass="bg-slate-100 text-slate-700"
                                    label="Phone"
                                    value={contactPhone}
                                    href={`tel:${contactPhone}`}
                                    onClick={track('call')}
                                />
                            )}
                            {whatsappHref && (
                                <ContactRow
                                    icon={MessageCircle}
                                    iconClass="bg-emerald-50 text-emerald-600"
                                    label="WhatsApp"
                                    value="Chat with the business"
                                    href={whatsappHref}
                                    external
                                    onClick={track('whatsapp')}
                                />
                            )}
                            {website && (
                                <ContactRow
                                    icon={Globe}
                                    iconClass="bg-sky-50 text-sky-600"
                                    label="Website"
                                    value={displayUrl(website)}
                                    href={toWebUrl(website)}
                                    external
                                    onClick={track('contact')}
                                />
                            )}
                            {fullAddress && (
                                <ContactRow
                                    icon={MapPin}
                                    iconClass="bg-rose-50 text-rose-500"
                                    label="Address"
                                    value={fullAddress}
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                                    external
                                />
                            )}
                        </div>
                    </section>
                )}

                <p className="px-4 pt-4 text-center text-[11px] text-slate-400">
                    This is a paid promotion. SevaFast is not responsible for offers made by advertisers.
                </p>
            </div>

            {/* Sticky actions */}
            {hasActions && (
                <div className="fixed bottom-0 inset-x-0 z-30">
                    <div className="mx-auto max-w-md bg-white border-t border-slate-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-3">
                        {contactPhone && (
                            <a
                                href={`tel:${contactPhone}`}
                                onClick={track('call')}
                                className="flex-1 h-12 rounded-xl border border-slate-300 text-slate-900 text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition"
                            >
                                <Phone className="h-4 w-4" />
                                Call
                            </a>
                        )}
                        {whatsappHref && (
                            <a
                                href={whatsappHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={track('whatsapp')}
                                className="flex-1 h-12 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition"
                            >
                                <MessageCircle className="h-4 w-4" />
                                WhatsApp
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* Full-screen image viewer */}
            {lightboxIndex !== null && images[lightboxIndex] && (
                <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
                    <button
                        onClick={() => setLightboxIndex(null)}
                        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                    {images.length > 1 && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    stepLightbox(-1);
                                }}
                                className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center"
                                aria-label="Previous image"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    stepLightbox(1);
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center"
                                aria-label="Next image"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </>
                    )}
                    <img
                        src={images[lightboxIndex].src}
                        alt={`${businessName} ${lightboxIndex + 1}`}
                        className="max-h-[90vh] max-w-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                    {images.length > 1 && (
                        <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-xs">
                            {lightboxIndex + 1} / {images.length}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default PromotionDetailPage;
