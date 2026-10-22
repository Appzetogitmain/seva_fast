import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft,
    Phone,
    MessageCircle,
    ExternalLink,
    MapPin,
    Share2,
    Check,
    Sparkles,
    Image as ImageIcon,
    Video as VideoIcon,
    AlertCircle,
    Loader2,
    X,
    Maximize2,
    ChevronLeft,
    ChevronRight,
    Building2,
    BadgeCheck,
    Volume2,
    VolumeX
} from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { useToast } from '@shared/components/ui/Toast';
import { trackAdInteraction } from '../../../core/utils/analyticsTracker';

const PromotionDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation('customer');
    const { showToast } = useToast();

    const [ad, setAd] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Video states: autoplay, mute/unmute, and arrow navigation
    const videoRef = useRef(null);
    const [isMuted, setIsMuted] = useState(true);
    const [activeVideoIndex, setActiveVideoIndex] = useState(0);

    // Poster carousel & lightbox states
    const carouselRef = useRef(null);
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchAd = async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await customerApi.getPlatformAdById(id);
                if (isMounted) {
                    const foundAd = (res.data?.success && res.data?.result) ? res.data.result : res.data?.result;
                    if (foundAd) {
                        setAd(foundAd);
                        if (foundAd._id) {
                            trackAdInteraction({ targetType: 'PlatformAd', targetId: foundAd._id, interactionType: 'visit' });
                        }
                    } else {
                        setError('Promotion not found or has expired.');
                    }
                }
            } catch (err) {
                if (isMounted) {
                    console.error('Failed to load promotion:', err);
                    setError(err.response?.data?.message || 'Unable to load promotion details.');
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        if (id) {
            fetchAd();
        }
        return () => {
            isMounted = false;
        };
    }, [id]);

    // Keyboard support for Lightbox modal
    useEffect(() => {
        if (lightboxIndex === null) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setLightboxIndex(null);
            if (e.key === 'ArrowRight') handleNextLightbox();
            if (e.key === 'ArrowLeft') handlePrevLightbox();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    });

    const posters = React.useMemo(() => {
        if (!ad) return [];
        const list = Array.isArray(ad.posters) && ad.posters.length > 0
            ? [...ad.posters]
            : (ad.imageUrl ? [ad.imageUrl] : (ad.mediaUrl && ad.mediaType === 'image' ? [ad.mediaUrl] : []));
        return list.filter(Boolean);
    }, [ad]);

    const videos = React.useMemo(() => {
        if (!ad) return [];
        const list = Array.isArray(ad.videos) && ad.videos.length > 0
            ? [...ad.videos]
            : (ad.videoUrl ? [ad.videoUrl] : (ad.mediaUrl && ad.mediaType === 'video' ? [ad.mediaUrl] : []));
        return list.filter(Boolean);
    }, [ad]);

    const activeVideoUrl = videos[activeVideoIndex] || videos[0] || null;

    // Change videos via left/right arrows
    const handlePrevVideo = (e) => {
        if (e) e.stopPropagation();
        if (videos.length <= 1) return;
        setActiveVideoIndex((prev) => (prev - 1 + videos.length) % videos.length);
    };

    const handleNextVideo = (e) => {
        if (e) e.stopPropagation();
        if (videos.length <= 1) return;
        setActiveVideoIndex((prev) => (prev + 1) % videos.length);
    };

    // Ensure video automatically plays and loops when switched
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(() => {});
        }
    }, [activeVideoIndex, activeVideoUrl]);

    // Toggle mute/unmute
    const toggleMute = (e) => {
        if (e) e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(videoRef.current.muted);
            if (videoRef.current.paused) {
                videoRef.current.play().catch(() => {});
            }
        }
    };

    // Carousel navigation
    const scrollCarousel = (direction) => {
        if (carouselRef.current) {
            const scrollAmount = direction === 'left' ? -340 : 340;
            carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    const handleNextLightbox = () => {
        if (posters.length === 0) return;
        setLightboxIndex((prev) => (prev + 1) % posters.length);
    };

    const handlePrevLightbox = () => {
        if (posters.length === 0) return;
        setLightboxIndex((prev) => (prev - 1 + posters.length) % posters.length);
    };

    const handleShare = async () => {
        const shareData = {
            title: ad?.businessName || ad?.title || 'Promotion on SevaFast',
            text: ad?.content || 'Check out this special promotion on SevaFast!',
            url: window.location.href,
        };

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
                showToast('Promotion link shared successfully', 'success');
                return;
            } catch (shareErr) {
                if (shareErr.name !== 'AbortError') {
                    console.warn('Web share failed, falling back to copy:', shareErr);
                }
            }
        }

        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            showToast('Link copied to clipboard!', 'success');
            setTimeout(() => setCopied(false), 2500);
        } catch {
            showToast('Could not copy link', 'error');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-slate-800">
                <Loader2 className="h-10 w-10 text-brand-600 animate-spin mb-3" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Loading Showcase...
                </p>
            </div>
        );
    }

    if (error || !ad) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-slate-800">
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-500 rounded-3xl mb-4 shadow-sm">
                    <AlertCircle className="h-10 w-10" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-2">Showcase Not Available</h2>
                <p className="text-sm text-slate-500 font-medium max-w-md mb-6 leading-relaxed">
                    {error || 'This promotion is no longer active or the link has expired.'}
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="px-6 py-3 bg-black hover:bg-slate-900 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                >
                    Back to Home
                </button>
            </div>
        );
    }

    const contactPhone = ad.contactPhone || ad.owner?.phone || '';
    const whatsappNum = (ad.whatsapp || contactPhone || '').replace(/[^0-9]/g, '');
    const cleanWhatsapp = whatsappNum.length === 10 ? `91${whatsappNum}` : whatsappNum;

    return (
        <div className="min-h-screen bg-slate-50/70 text-slate-900 font-sans selection:bg-brand-500 selection:text-white">
            {/* CLEAN FLOATING TOP HEADER */}
            <header className="sticky top-0 z-40 px-4 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-sm transition-all">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black uppercase tracking-wider transition-all active:scale-95"
                        title="Go Back"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Back</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-widest">
                            <Sparkles className="h-3 w-3 text-emerald-600" />
                            <span>SevaFast Promotional Showcase</span>
                        </span>
                        {ad.city && (
                            <span className="hidden md:inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold uppercase tracking-wider">
                                <MapPin className="h-3 w-3 text-slate-500" />
                                <span>{ad.city}</span>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {contactPhone && (
                            <a
                                href={`tel:${contactPhone}`}
                                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black uppercase tracking-wider transition-all"
                            >
                                <Phone className="h-3.5 w-3.5 text-slate-700" />
                                <span>Call</span>
                            </a>
                        )}

                        <button
                            onClick={handleShare}
                            className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-95 flex items-center justify-center border border-slate-200"
                            title="Share this promotion"
                            aria-label="Share"
                        >
                            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT CONTAINER */}
            <main className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-8 pb-32">
                {/* ========================================================================= */}
                {/* 1ST ROW: FULL-WIDTH TOP AUTOPLAY VIDEO (WITH AUDIO ON/OFF ONLY)          */}
                {/* ========================================================================= */}
                {activeVideoUrl ? (
                    <section className="relative rounded-[32px] md:rounded-[44px] overflow-hidden bg-black shadow-xl border border-slate-200/80">
                        {/* CONTINUOUS AUTOPLAY AD VIDEO (NO PAUSE / NO MEDIA CONTROLS) */}
                        <div className="relative w-full aspect-video max-h-[580px] bg-black flex items-center justify-center select-none overflow-hidden">
                            <video
                                ref={videoRef}
                                key={activeVideoUrl}
                                src={activeVideoUrl}
                                autoPlay
                                loop
                                muted={isMuted}
                                playsInline
                                disablePictureInPicture
                                disableRemotePlayback
                                controls={false}
                                controlsList="nodownload nofullscreen noremoteplayback"
                                className="w-full h-full object-contain bg-black pointer-events-none"
                            />

                            {/* PREVIOUS / NEXT ARROWS TO CHANGE VIDEOS */}
                            {videos.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handlePrevVideo}
                                        className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 z-30 p-2.5 md:p-3 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 shadow-2xl transition-all active:scale-90 flex items-center justify-center group"
                                        title="Previous Video"
                                        aria-label="Previous Video"
                                    >
                                        <ChevronLeft className="h-5 w-5 md:h-6 md:w-6 transition-transform group-hover:-translate-x-0.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleNextVideo}
                                        className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 z-30 p-2.5 md:p-3 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 shadow-2xl transition-all active:scale-90 flex items-center justify-center group"
                                        title="Next Video"
                                        aria-label="Next Video"
                                    >
                                        <ChevronRight className="h-5 w-5 md:h-6 md:w-6 transition-transform group-hover:translate-x-0.5" />
                                    </button>
                                </>
                            )}

                            {/* BOTTOM-LEFT: BUSINESS NAME OVERLAY TAG */}
                            <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
                                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-black/70 backdrop-blur-md border border-white/20 text-white text-xs font-black uppercase tracking-wider shadow-lg">
                                    <Sparkles className="h-3.5 w-3.5 text-brand-400" />
                                    <span className="truncate max-w-[200px] sm:max-w-xs">{ad.businessName || ad.title}</span>
                                </div>
                            </div>

                            {/* BOTTOM-RIGHT: SOUND ON / OFF TOGGLE BUTTON */}
                            <button
                                type="button"
                                onClick={toggleMute}
                                className="absolute bottom-4 right-4 z-20 px-4 py-2.5 rounded-full bg-black/75 hover:bg-black/95 text-white backdrop-blur-md shadow-2xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-wider border border-white/20 active:scale-95"
                                title={isMuted ? 'Turn Sound On' : 'Turn Sound Off'}
                            >
                                {isMuted ? (
                                    <>
                                        <VolumeX className="h-4 w-4 text-rose-400" />
                                        <span>Tap for Sound</span>
                                    </>
                                ) : (
                                    <>
                                        <Volume2 className="h-4 w-4 text-emerald-400 animate-pulse" />
                                        <span>Sound On</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </section>
                ) : (
                    /* FALLBACK HERO IMAGE IF NO VIDEO EXISTS */
                    <section className="relative rounded-[32px] md:rounded-[44px] overflow-hidden bg-slate-100 shadow-xl border border-slate-200/80 aspect-video max-h-[500px] flex items-center justify-center">
                        {posters[0] ? (
                            <img src={posters[0]} alt={ad.title} className="w-full h-full object-contain" />
                        ) : (
                            <div className="text-center p-6 text-slate-400 font-bold uppercase text-xs">
                                Promotional Showcase
                            </div>
                        )}
                    </section>
                )}

                {/* ========================================================================= */}
                {/* 2ND ROW: POSTERS CAROUSEL SLIDER WITH NEXT/PREV CONTROLS                  */}
                {/* ========================================================================= */}
                {posters.length > 0 && (
                    <section className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 border border-slate-200/80 shadow-md space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                                    <ImageIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight">
                                        Promotional Posters
                                    </h2>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Swipe horizontally or tap any poster to view in full resolution
                                    </p>
                                </div>
                            </div>

                            {/* CAROUSEL LEFT / RIGHT ARROW BUTTONS */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => scrollCarousel('left')}
                                    className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all border border-slate-200 active:scale-95"
                                    title="Scroll Left"
                                    aria-label="Previous"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => scrollCarousel('right')}
                                    className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all border border-slate-200 active:scale-95"
                                    title="Scroll Right"
                                    aria-label="Next"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* HORIZONTAL CAROUSEL CONTAINER */}
                        <div
                            ref={carouselRef}
                            className="flex items-center gap-4 overflow-x-auto scroll-smooth pb-3 snap-x snap-mandatory scrollbar-thin"
                        >
                            {posters.map((imgUrl, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setLightboxIndex(idx)}
                                    className="snap-start shrink-0 w-64 sm:w-72 md:w-80 group relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer shadow-sm hover:shadow-md transition-all select-none"
                                >
                                    <img
                                        src={imgUrl}
                                        alt={`Poster ${idx + 1}`}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3.5">
                                        <span className="self-end p-2 bg-white/90 backdrop-blur-md rounded-xl text-slate-900 shadow">
                                            <Maximize2 className="h-3.5 w-3.5" />
                                        </span>
                                        <div className="text-[11px] font-black uppercase text-white tracking-wider">
                                            Poster #{idx + 1} &bull; Tap to zoom
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ========================================================================= */}
                {/* 3RD ROW: BUSINESS DETAILS, HIGHLIGHTS & CONTACT ACTIONS                   */}
                {/* ========================================================================= */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* LEFT / MAIN (2 COLS): BUSINESS BRIEF & DESCRIPTION */}
                    <div className="md:col-span-2 bg-white rounded-[32px] p-6 md:p-8 border border-slate-200/80 shadow-md space-y-6">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-widest">
                                    <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>Verified Business</span>
                                </span>
                                {ad.city && (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-black uppercase tracking-wider">
                                        <MapPin className="h-3 w-3 text-slate-500" />
                                        <span>{ad.city}</span>
                                    </span>
                                )}
                            </div>

                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight leading-tight">
                                    {ad.businessName || ad.title}
                                </h1>
                                {ad.businessName && ad.businessName !== ad.title && (
                                    <p className="text-sm font-bold text-brand-600 mt-1 uppercase tracking-wide">
                                        {ad.title}
                                    </p>
                                )}
                            </div>

                            {ad.address && (
                                <p className="text-xs text-slate-600 font-medium flex items-start gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                    <MapPin className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
                                    <span>{ad.address}, {ad.city}</span>
                                </p>
                            )}
                        </div>

                        <div className="space-y-2 border-t border-slate-100 pt-5">
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                                Offer & Service Details
                            </h2>
                            <div className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-line bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                {ad.content}
                            </div>
                        </div>

                        {/* CALL TO ACTION BUTTONS */}
                        <div className="space-y-3 pt-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {contactPhone && (
                                    <a
                                        href={`tel:${contactPhone}`}
                                        onClick={() => trackAdInteraction({ targetType: 'PlatformAd', targetId: ad._id, interactionType: 'call' })}
                                        className="px-6 py-4 rounded-2xl bg-black hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
                                    >
                                        <Phone className="h-4 w-4 text-white" />
                                        <span>Call Direct &bull; {contactPhone}</span>
                                    </a>
                                )}

                                {cleanWhatsapp && (
                                    <a
                                        href={`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(`Hello, I saw your "${ad.title}" promotional video on SevaFast!`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => trackAdInteraction({ targetType: 'PlatformAd', targetId: ad._id, interactionType: 'whatsapp' })}
                                        className="px-6 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95"
                                    >
                                        <MessageCircle className="h-4 w-4" />
                                        <span>Inquire on WhatsApp</span>
                                    </a>
                                )}
                            </div>

                            {ad.targetUrl && (
                                <a
                                    href={ad.targetUrl.startsWith('http') ? ad.targetUrl : `https://${ad.targetUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => trackAdInteraction({ targetType: 'PlatformAd', targetId: ad._id, interactionType: 'contact' })}
                                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-slate-200"
                                >
                                    <span>Visit Official Website</span>
                                    <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* RIGHT (1 COL): ADVERTISER TRUST & CONTACT CARD */}
                    <div className="bg-white rounded-[32px] p-6 md:p-8 border border-slate-200/80 shadow-md space-y-5 flex flex-col justify-between">
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-brand-600" />
                                <span>Advertiser Card</span>
                            </h3>

                            <div className="space-y-3 text-xs font-semibold text-slate-700">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Business</span>
                                    <span className="text-slate-900 font-bold text-sm">{ad.businessName || ad.title}</span>
                                </div>

                                {ad.city && (
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Operating City</span>
                                        <span className="text-slate-900 font-bold">{ad.city}</span>
                                    </div>
                                )}

                                {contactPhone && (
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Direct Phone</span>
                                        <span className="text-slate-900 font-bold">{contactPhone}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center space-y-1 mt-4">
                            <p className="text-[10px] text-slate-500 font-medium">Direct connection with local service provider</p>
                        </div>
                    </div>
                </section>

                {/* TRUST & FOOTER CALLOUT */}
                <footer className="text-center py-6 border-t border-slate-200 space-y-3">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                        Promoted on SevaFast &bull; Fast Local Services Network
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <button
                            onClick={() => navigate('/')}
                            className="px-6 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black uppercase tracking-wider transition-all border border-slate-200"
                        >
                            Visit SevaFast Home
                        </button>
                    </div>
                </footer>
            </main>

            {/* STICKY BOTTOM BAR FOR FAST MOBILE ACCESS */}
            <div className="fixed bottom-0 inset-x-0 z-40 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg md:hidden">
                <div className="flex items-center gap-3">
                    {contactPhone && (
                        <a
                            href={`tel:${contactPhone}`}
                            onClick={() => trackAdInteraction({ targetType: 'PlatformAd', targetId: ad._id, interactionType: 'call' })}
                            className="flex-1 py-3.5 rounded-2xl bg-black text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-95 text-center"
                        >
                            <Phone className="h-4 w-4 text-white" />
                            <span>Call Now</span>
                        </a>
                    )}

                    {cleanWhatsapp && (
                        <a
                            href={`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(`Hello, I saw your "${ad.title}" promotional video on SevaFast!`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackAdInteraction({ targetType: 'PlatformAd', targetId: ad._id, interactionType: 'whatsapp' })}
                            className="flex-1 py-3.5 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 text-center"
                        >
                            <MessageCircle className="h-4 w-4" />
                            <span>WhatsApp</span>
                        </a>
                    )}
                </div>
            </div>

            {/* FULLSCREEN LIGHTBOX MODAL WITH NEXT / PREV / KEYBOARD ARROWS */}
            {lightboxIndex !== null && posters[lightboxIndex] && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in select-none"
                    onClick={() => setLightboxIndex(null)}
                >
                    {/* CLOSE BUTTON */}
                    <button
                        onClick={() => setLightboxIndex(null)}
                        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-10"
                        title="Close (Esc)"
                    >
                        <X className="h-6 w-6" />
                    </button>

                    {/* PREV BUTTON */}
                    {posters.length > 1 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handlePrevLightbox();
                            }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/25 text-white rounded-full transition-all z-10"
                            title="Previous (Left Arrow)"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </button>
                    )}

                    {/* ENLARGED IMAGE */}
                    <div className="relative max-h-[88vh] max-w-[92vw] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={posters[lightboxIndex]}
                            alt={`Full Poster ${lightboxIndex + 1}`}
                            className="max-h-[82vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl border border-white/10"
                        />
                        <div className="mt-3 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-black uppercase tracking-wider border border-white/10">
                            Poster {lightboxIndex + 1} of {posters.length}
                        </div>
                    </div>

                    {/* NEXT BUTTON */}
                    {posters.length > 1 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleNextLightbox();
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/25 text-white rounded-full transition-all z-10"
                            title="Next (Right Arrow)"
                        >
                            <ChevronRight className="h-6 w-6" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default PromotionDetailPage;
