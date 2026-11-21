import React, { useMemo, useState } from 'react';

/**
 * Media preview for an advertiser's own banner ad card: one large viewer plus
 * tappable thumbnails. Images are shown whole (never cropped) over a blurred
 * copy of themselves, so any aspect ratio looks intentional.
 */
const AdMediaPreview = ({ ad, emptyLabel = 'No image' }) => {
    const media = useMemo(() => {
        const seen = new Set();
        return [
            ...[ad?.imageUrl, ...(ad?.posters || [])].map((src) => ({ type: 'image', src })),
            ...[ad?.videoUrl, ...(ad?.videos || [])].map((src) => ({ type: 'video', src })),
            { type: ad?.mediaType === 'video' ? 'video' : 'image', src: ad?.mediaUrl },
        ].filter((m) => m.src && !seen.has(m.src) && seen.add(m.src));
    }, [ad]);

    const [selected, setSelected] = useState(0);
    const active = media[Math.min(selected, media.length - 1)];
    const imageCount = media.filter((m) => m.type === 'image').length;
    const videoCount = media.length - imageCount;
    const countLabel = [
        imageCount && `${imageCount} photo${imageCount > 1 ? 's' : ''}`,
        videoCount && `${videoCount} video${videoCount > 1 ? 's' : ''}`,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <div className="space-y-2">
            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-100 flex items-center justify-center">
                {!active ? (
                    <span className="text-xs font-medium text-slate-400">{emptyLabel}</span>
                ) : active.type === 'video' ? (
                    <video key={active.src} src={active.src} controls playsInline className="w-full h-full object-contain bg-black" />
                ) : (
                    <>
                        <img
                            src={active.src}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-50"
                        />
                        <img src={active.src} alt={ad?.title || ''} className="relative w-full h-full object-contain" />
                    </>
                )}
                {media.length > 1 && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-semibold">
                        {Math.min(selected, media.length - 1) + 1}/{media.length} · {countLabel}
                    </span>
                )}
            </div>

            {media.length > 1 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {media.map((m, idx) => {
                        const isActive = m === active;
                        return (
                            <button
                                key={m.src}
                                type="button"
                                onClick={() => setSelected(idx)}
                                aria-label={`Show ${m.type} ${idx + 1}`}
                                className={`relative shrink-0 h-14 w-14 rounded-lg overflow-hidden bg-slate-100 transition ${
                                    isActive ? 'ring-2 ring-slate-900 ring-offset-1' : 'opacity-70 hover:opacity-100'
                                }`}
                            >
                                {m.type === 'video' ? (
                                    <>
                                        <video src={m.src} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                                        <span className="absolute inset-0 flex items-center justify-center">
                                            <span className="h-5 w-5 rounded-full bg-black/60 text-white text-[8px] flex items-center justify-center">▶</span>
                                        </span>
                                    </>
                                ) : (
                                    <img src={m.src} alt="" loading="lazy" className="w-full h-full object-cover" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AdMediaPreview;
