import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

const PlatformBannerSlider = ({ ads = [] }) => {
  const navigate = useNavigate();
  if (!ads || ads.length === 0) return null;

  const [isMuted, setIsMuted] = useState(true);
  const videoRefs = useRef({});

  // Duplicate ads list to construct a seamless infinite marquee loop
  const duplicatedAds = [...ads, ...ads];

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 md:px-8 lg:px-[50px] mb-6 overflow-hidden">
      <style>{`
        @keyframes ad-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .ad-marquee-track {
          display: flex;
          gap: 12px;
          width: max-content;
          animation: ad-marquee 20s linear infinite;
        }
        @media (min-width: 768px) {
          .ad-marquee-track {
            gap: 24px;
          }
        }
        .ad-marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="relative w-full overflow-hidden">
        <div className="ad-marquee-track">
          {duplicatedAds.map((adItem, idx) => {
            const handleAdClick = () => {
              if (adItem?.targetUrl) {
                const target = adItem.targetUrl.trim();
                if (/^https?:\/\//i.test(target)) {
                  window.open(target, "_blank", "noopener,noreferrer");
                } else if (/^www\./i.test(target)) {
                  window.open(`https://${target}`, "_blank", "noopener,noreferrer");
                } else {
                  const targetPath = target.startsWith("/") ? target : `/${target}`;
                  navigate(targetPath);
                }
              }
            };

            return (
              <div
                key={idx}
                onClick={handleAdClick}
                className={cn(
                  "ad-card relative shrink-0 h-[135px] sm:h-[160px] md:h-[200px] w-[calc(50vw-22px)] md:w-[calc(50vw-62px)] max-w-[620px] rounded-[16px] md:rounded-[24px] overflow-hidden shadow-md border border-slate-100 bg-slate-900 group select-none transition-all duration-300 hover:shadow-lg flex items-center justify-center",
                  adItem?.targetUrl ? "cursor-pointer" : ""
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMuted(!isMuted);
                      }}
                      className="absolute bottom-2.5 right-2.5 z-30 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-md border border-white/10 transition-all active:scale-90"
                      title={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                    </button>
                  </div>
                ) : adItem.imageUrl || adItem.mediaUrl ? (
                  <img
                    src={adItem.imageUrl || adItem.mediaUrl}
                    alt={adItem.title}
                    className="w-full h-full object-cover pointer-events-none"
                    loading="eager"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-brand-900 via-indigo-950 to-slate-900 pointer-events-none" />
                )}

                {/* Gradient Overlay for Text Visibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent z-10 pointer-events-none" />

                {/* Content Overlays */}
                <div className="absolute bottom-0 left-0 w-full p-3 md:p-4.5 z-20 flex flex-col justify-end h-full">
                  <div className="space-y-1 text-left pointer-events-none max-w-full">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-brand-500/20 text-brand-400 border border-brand-500/30 text-[7px] md:text-[8px] font-black tracking-wider uppercase rounded backdrop-blur-sm">
                        Sponsored
                      </span>
                      {adItem.city && (
                        <span className="px-1.5 py-0.5 bg-white/10 text-slate-200 text-[7px] md:text-[8px] font-black tracking-wider uppercase rounded backdrop-blur-sm">
                          {adItem.city}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xxs sm:text-xs md:text-sm font-black text-white uppercase tracking-tight leading-tight">
                      {adItem.title}
                    </h3>
                    <p className="text-[7px] sm:text-[8px] md:text-[9px] text-slate-300 font-bold opacity-90 line-clamp-1 leading-normal">
                      {adItem.content}
                    </p>
                  </div>

                  {adItem.targetUrl && (
                    <div className="shrink-0 flex items-center mt-2">
                      <button className="flex items-center gap-1 px-2.5 py-1 bg-white text-black hover:bg-brand-50 rounded-full text-[7px] md:text-[8px] font-black uppercase tracking-wider shadow-md transition-all active:scale-95">
                        Visit
                        <ExternalLink className="h-2 w-2 text-black" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlatformBannerSlider;
