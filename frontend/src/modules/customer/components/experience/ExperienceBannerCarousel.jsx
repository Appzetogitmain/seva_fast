import React from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, useMotionValue } from "framer-motion";
import {
  applyCloudinaryTransform,
  buildCloudinarySrcSet,
  isCloudinaryUrl,
} from "@/core/utils/imageUtils";

import { isMobileOrWebView } from "@/core/utils/deviceUtils";

const BANNER_CHUNK_SIZE = 20;

const ExperienceBannerCarousel = ({ section, items, fullWidth = false, slideGap = 0, edgeToEdge = false }) => {
  const navigate = useNavigate();
  if (!items || !items.length) return null;

  const [activeIndex, setActiveIndex] = React.useState(0);
  const [visibleCount, setVisibleCount] = React.useState(() =>
    Math.min(items.length, BANNER_CHUNK_SIZE)
  );
  const visibleItems = items.slice(0, visibleCount);
  const totalItems = visibleItems.length;
  const x = useMotionValue(0);
  const containerRef = React.useRef(null);
  const hasMore = visibleCount < items.length;
  const isDraggingRef = React.useRef(false);

  const loadMore = React.useCallback(() => {
    setVisibleCount((prev) => Math.min(items.length, prev + BANNER_CHUNK_SIZE));
  }, [items.length]);

  React.useEffect(() => {
    setVisibleCount(Math.min(items.length, BANNER_CHUNK_SIZE));
    setActiveIndex(0);
  }, [items.length]);

  // Auto-play logic
  React.useEffect(() => {
    if (totalItems <= 1) return;

    const intervalId = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalItems);
    }, 4500);

    return () => clearInterval(intervalId);
  }, [totalItems]);

  React.useEffect(() => {
    if (!hasMore) return;
    if (activeIndex >= totalItems - 2) {
      loadMore();
    }
  }, [activeIndex, totalItems, hasMore, loadMore]);

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDragEnd = (_, info) => {
    const threshold = 50;
    if (info.offset.x < -threshold) {
      // Swipe left -> Next
      setActiveIndex((prev) => Math.min(prev + 1, totalItems - 1));
    } else if (info.offset.x > threshold) {
      // Swipe right -> Prev
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 120);
  };

  const handleBannerClick = (banner, e) => {
    if (isDraggingRef.current) return;
    if (!banner) return;

    const linkType = (banner.linkType || "").toLowerCase();
    const rawVal = (
      banner.linkValue ||
      banner.url ||
      banner.link ||
      banner.targetUrl ||
      ""
    ).trim();

    if (!rawVal || linkType === "none") return;

    if (e) {
      e.stopPropagation();
    }

    if (linkType === "category" || linkType === "subcategory" || linkType === "header") {
      if (rawVal.startsWith("/")) {
        navigate(rawVal);
      } else {
        navigate(`/category/${rawVal}`);
      }
      return;
    }

    if (linkType === "product") {
      if (rawVal.startsWith("/")) {
        navigate(rawVal);
      } else {
        navigate(`/product/${rawVal}`);
      }
      return;
    }

    // URL or custom internal/external path
    if (/^https?:\/\//i.test(rawVal)) {
      window.open(rawVal, "_blank", "noopener,noreferrer");
    } else if (/^www\./i.test(rawVal)) {
      window.open(`https://${rawVal}`, "_blank", "noopener,noreferrer");
    } else {
      const targetPath = rawVal.startsWith("/") ? rawVal : `/${rawVal}`;
      navigate(targetPath);
    }
  };

  const getBannerOptimizedSrc = React.useCallback((url) => {
    if (!url) return url;
    if (!isCloudinaryUrl(url)) return url;
    return applyCloudinaryTransform(url, "f_auto,q_auto,c_fill,g_auto,w_824,h_380");
  }, []);

  return (
    <div className={cn("overflow-hidden touch-pan-y", fullWidth && "w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]")}>
      <motion.div
        ref={containerRef}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={{ x: `-${(activeIndex / totalItems) * 100}%` }}
        transition={isMobileOrWebView() ? { type: "tween", ease: "easeInOut", duration: 0.3 } : { type: "spring", stiffness: 300, damping: 30 }}
        className="flex"
        style={{ width: `${totalItems * 100}%` }}
      >
        {visibleItems.map((banner, idx) => {
          const rawVal = (
            banner.linkValue ||
            banner.url ||
            banner.link ||
            banner.targetUrl ||
            ""
          ).trim();
          const hasLink = Boolean(rawVal && (banner.linkType || "url") !== "none");

          return (
            <div
              key={idx}
              className={cn(
                "relative shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center box-border select-none",
                fullWidth ? "h-[190px] sm:h-[240px] md:h-[300px] lg:h-[380px] xl:h-[420px] rounded-none px-0" : "h-[190px] sm:h-[240px] md:h-[300px] lg:h-[380px] xl:h-[420px] px-4 md:px-8",
                hasLink && "cursor-pointer"
              )}
              style={{ width: `${100 / totalItems}%` }}
              onClick={hasLink ? (e) => handleBannerClick(banner, e) : undefined}
              role={hasLink ? "button" : undefined}
              tabIndex={hasLink ? 0 : undefined}
              title={banner.title || (hasLink ? "Click to view" : undefined)}
              onKeyDown={
                hasLink
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleBannerClick(banner, e);
                      }
                    }
                  : undefined
              }
            >
              {fullWidth ? (
                <img
                  src={getBannerOptimizedSrc(banner.imageUrl)}
                  srcSet={
                    isCloudinaryUrl(banner.imageUrl)
                      ? buildCloudinarySrcSet(banner.imageUrl, [
                          { w: 412, h: 190 },
                          { w: 824, h: 380 },
                          { w: 1248, h: 570 },
                        ])
                      : undefined
                  }
                  sizes="100vw"
                  alt={banner.title || section?.title || "Banner"}
                  className={cn(
                    "w-full h-full object-cover object-center pointer-events-none transition-transform duration-300",
                    hasLink && "hover:scale-[1.01]"
                  )}
                  width={412}
                  height={190}
                  loading={idx === 0 ? "eager" : "lazy"}
                  fetchPriority={idx === 0 ? "high" : "low"}
                  decoding="async"
                />
              ) : (
                <div
                  className={cn(
                    "h-full w-full max-w-[560px] overflow-hidden rounded-3xl bg-slate-100 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-all duration-300",
                    hasLink && "hover:shadow-[0_16px_36px_rgba(15,23,42,0.14)] hover:scale-[1.01]"
                  )}
                >
                  <img
                    src={getBannerOptimizedSrc(banner.imageUrl)}
                    srcSet={
                      isCloudinaryUrl(banner.imageUrl)
                        ? buildCloudinarySrcSet(banner.imageUrl, [
                            { w: 560, h: 190 },
                            { w: 1120, h: 380 },
                          ])
                        : undefined
                    }
                    sizes="(max-width: 768px) 100vw, 560px"
                    alt={banner.title || section?.title || "Banner"}
                    className="w-full h-full object-cover object-center pointer-events-none"
                    width={560}
                    height={190}
                    loading={idx === 0 ? "eager" : "lazy"}
                    fetchPriority={idx === 0 ? "high" : "low"}
                    decoding="async"
                  />
                </div>
              )}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default ExperienceBannerCarousel;

