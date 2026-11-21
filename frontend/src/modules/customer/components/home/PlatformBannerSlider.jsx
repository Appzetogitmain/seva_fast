import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from 'react-i18next';
import { useNavigate } from "react-router-dom";
import { ExternalLink, Volume2, VolumeX, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackAdInteraction } from "../../../../core/utils/analyticsTracker";

const PlatformBannerSliderInner = ({ ads = [] }) => {
  const { t } = useTranslation('customer');
  const navigate = useNavigate();

  const [isMuted, setIsMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const videoRefs = useRef({});
  const sliderRef = useRef(null);

  const totalAds = ads.length;

  const scrollToSlide = useCallback((index) => {
    if (!sliderRef.current || totalAds === 0) return;
    const targetIdx = (index + totalAds) % totalAds;
    const container = sliderRef.current;
    const cards = container.querySelectorAll('.ad-card');
    if (cards[targetIdx]) {
      cards[targetIdx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      setActiveIndex(targetIdx);
    }
  }, [totalAds]);

  const handleScroll = () => {
    if (!sliderRef.current || totalAds === 0) return;
    const container = sliderRef.current;
    const cards = container.querySelectorAll('.ad-card');
    if (!cards.length) return;

    const containerCenter = container.getBoundingClientRect().left + container.offsetWidth / 2;
    let closestIndex = 0;
    let minDistance = Infinity;

    cards.forEach((card, idx) => {
      const cardCenter = card.getBoundingClientRect().left + card.offsetWidth / 2;
      const dist = Math.abs(containerCenter - cardCenter);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = idx;
      }
    });

    setActiveIndex(closestIndex % totalAds);
  };

  // Auto-advance banner every 4.5 seconds when not hovered/touched
  useEffect(() => {
    if (totalAds <= 1 || isPaused) return;
    const interval = setInterval(() => {
      scrollToSlide(activeIndex + 1);
    }, 4500);
    return () => clearInterval(interval);
  }, [activeIndex, totalAds, isPaused, scrollToSlide]);

  return (
    <div
      className="w-full max-w-[1400px] mx-auto px-4 md:px-8 lg:px-[50px] mb-6 relative group/slider"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setTimeout(() => setIsPaused(false), 2000)}
    >
      {/* Desktop Prev Button */}
      {totalAds > 1 && (
        <button
          type="button"
          aria-label="Previous promotional slide"
          onClick={() => scrollToSlide(activeIndex - 1)}
          className="hidden md:flex absolute left-2 lg:left-8 top-1/2 -translate-y-1/2 z-30 h-10 w-10 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 items-center justify-center shadow-lg transition-all opacity-0 group-hover/slider:opacity-100 active:scale-95 cursor-pointer"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Swipeable Track (CSS Scroll Snap + Touch Support) */}
      <div
        ref={sliderRef}
        onScroll={handleScroll}
        className="flex items-center gap-3 sm:gap-4 md:gap-6 overflow-x-auto no-scrollbar scroll-smooth snap-x touch-pan-x py-1"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {ads.map((adItem, idx) => {
          const hasExternal = Boolean(adItem?.hasExternalUrl && adItem?.targetUrl?.trim());

          const handleAdClick = () => {
            if (adItem?._id) {
              trackAdInteraction({ targetType: 'PlatformAd', targetId: adItem._id, interactionType: 'visit' });
            }
            if (hasExternal) {
              if (adItem?._id) {
                trackAdInteraction({ targetType: 'PlatformAd', targetId: adItem._id, interactionType: 'contact' });
              }
              const target = adItem.targetUrl.trim();
              if (/^https?:\/\//i.test(target)) {
                window.open(target, "_blank", "noopener,noreferrer");
              } else if (/^www\./i.test(target)) {
                window.open(`https://${target}`, "_blank", "noopener,noreferrer");
              } else {
                const targetPath = target.startsWith("/") ? target : `/${target}`;
                navigate(targetPath);
              }
            } else if (adItem?._id) {
              navigate(`/promotions/${adItem._id}`);
            }
          };

          return (
            <div
              key={adItem._id || idx}
              onClick={handleAdClick}
              className={cn(
                "ad-card relative shrink-0 h-[145px] sm:h-[170px] md:h-[210px] w-[84vw] sm:w-[380px] md:w-[480px] lg:w-[560px] max-w-[620px] rounded-[20px] md:rounded-[24px] overflow-hidden shadow-sm hover:shadow-lg border border-slate-100 bg-slate-900 group select-none transition-all duration-300 flex items-center justify-center cursor-pointer snap-center"
              )}
            >
              {/* Media Rendering */}
              {adItem.videoUrl || (adItem.mediaUrl && adItem.mediaType === "video") ? (
                <div className="relative w-full h-full">
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current[idx] = el;
                    }}
                    src={adItem.videoUrl || adItem.mediaUrl}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted={isMuted}
                    playsInline
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted(!isMuted);
                    }}
                    className="absolute bottom-2.5 right-2.5 z-30 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-md border border-white/10 transition-all active:scale-90 cursor-pointer"
                    title={isMuted ? t('home.unmute', { defaultValue: 'Unmute' }) : t('home.mute', { defaultValue: 'Mute' })}
                  >
                    {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ) : adItem.imageUrl || adItem.mediaUrl || (Array.isArray(adItem.posters) && adItem.posters[0]) ? (
                <img
                  src={adItem.imageUrl || adItem.mediaUrl || adItem.posters[0]}
                  alt={adItem.title}
                  className="w-full h-full object-cover pointer-events-none"
                  loading="eager"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-orange-950 via-slate-900 to-indigo-950 pointer-events-none" />
              )}

              {/* Gradient Overlay for Text Visibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent z-10 pointer-events-none" />

              {/* Content Overlays */}
              <div className="absolute bottom-0 left-0 w-full p-3 sm:p-4 md:p-5 z-20 flex flex-col justify-end h-full">
                <div className="space-y-1 text-left pointer-events-none max-w-full">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-1.5 py-0.5 bg-[#FF5A00]/25 text-[#FF8A48] border border-[#FF5A00]/40 text-[7px] md:text-[8px] font-black tracking-wider uppercase rounded backdrop-blur-sm">
                      {t('home.sponsored', { defaultValue: 'Sponsored' })}
                    </span>
                    {adItem.city && (
                      <span className="px-1.5 py-0.5 bg-white/10 text-slate-200 text-[7px] md:text-[8px] font-black tracking-wider uppercase rounded backdrop-blur-sm">
                        {adItem.city}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs sm:text-sm md:text-base font-black text-white uppercase tracking-tight leading-tight line-clamp-1">
                    {adItem.businessName || adItem.title}
                  </h3>
                  <p className="text-[8px] sm:text-[9px] md:text-[10px] text-slate-300 font-bold opacity-90 line-clamp-1 leading-normal">
                    {adItem.content}
                  </p>
                </div>

                <div className="shrink-0 flex items-center mt-2">
                  {hasExternal ? (
                    <button
                      type="button"
                      className="flex items-center gap-1 px-3 py-1 bg-white text-black hover:bg-slate-100 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-wider shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      {t('home.visit', { defaultValue: 'Visit' })}
                      <ExternalLink className="h-2.5 w-2.5 text-black" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="flex items-center gap-1 px-3 py-1 bg-[#FF5A00] hover:bg-[#E04F00] text-white rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-wider shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      <span>Showcase</span>
                      <ChevronRight className="h-3 w-3 text-white" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Next Button */}
      {totalAds > 1 && (
        <button
          type="button"
          aria-label="Next promotional slide"
          onClick={() => scrollToSlide(activeIndex + 1)}
          className="hidden md:flex absolute right-2 lg:right-8 top-1/2 -translate-y-1/2 z-30 h-10 w-10 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 items-center justify-center shadow-lg transition-all opacity-0 group-hover/slider:opacity-100 active:scale-95 cursor-pointer"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Slide Dots Indicator */}
      {totalAds > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {ads.map((_, dotIdx) => (
            <button
              key={dotIdx}
              type="button"
              aria-label={`Go to slide ${dotIdx + 1}`}
              onClick={() => scrollToSlide(dotIdx)}
              className={cn(
                "h-1.5 rounded-full transition-all cursor-pointer",
                dotIdx === activeIndex
                  ? "w-6 bg-[#FF5A00]"
                  : "w-1.5 bg-slate-300 hover:bg-slate-400"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const PlatformBannerSlider = (props) => (!props.ads?.length ? null : <PlatformBannerSliderInner {...props} />);

export default PlatformBannerSlider;
