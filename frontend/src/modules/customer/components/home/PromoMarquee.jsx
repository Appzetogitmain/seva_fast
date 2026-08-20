import React, { useMemo } from "react";
import { buildMarqueeMessages } from "../../constants/homeConstants";
import { useSettings } from "@core/context/SettingsContext";

const PromoMarquee = () => {
  const { settings } = useSettings();
  const marqueeMessages = useMemo(
    () => buildMarqueeMessages(settings?.minimumOrderValue),
    [settings?.minimumOrderValue],
  );

  return (
    <div className="w-full mt-1.5 mb-3 md:mt-0 md:mb-4">
      <div className="relative overflow-hidden border-y border-[#389ecb] bg-primary shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
        <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-primary via-primary/90 to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-primary via-primary/90 to-transparent pointer-events-none" />
        <div className="classic-marquee-track flex w-max items-center gap-4 px-3 py-2 text-xs sm:text-sm font-semibold text-white md:px-6 md:py-2 md:text-base">
          {[...marqueeMessages, ...marqueeMessages].map((message, idx) => (
            <React.Fragment key={`${message}-${idx}`}>
              <span className="whitespace-nowrap">{message}</span>
              <span className="text-white/60">•</span>
            </React.Fragment>
          ))}
          <span className="whitespace-nowrap">❤️</span>
          <span className="whitespace-nowrap">🎁</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PromoMarquee);
