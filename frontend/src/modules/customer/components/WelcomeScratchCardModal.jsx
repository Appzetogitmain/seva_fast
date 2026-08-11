import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Gift, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const WelcomeScratchCardModal = ({
    isOpen = false,
    onClose,
    discountPercent = 10,
    freeDelivery = true,
    userId = 'guest',
}) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isScratched, setIsScratched] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [scratchPercent, setScratchPercent] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);

    // Initialize Canvas when modal opens
    useEffect(() => {
        if (!isOpen) return;

        const storageKey = `welcome_scratch_card_done_${userId}`;
        if (localStorage.getItem(storageKey) === 'true') {
            setIsScratched(true);
            return;
        }

        const timer = setTimeout(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            const width = canvas.offsetWidth || 340;
            const height = canvas.offsetHeight || 220;

            canvas.width = width;
            canvas.height = height;

            // Draw metallic silver/purple scratch layer
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#7e22ce');
            grad.addColorStop(0.5, '#a855f7');
            grad.addColorStop(1, '#6b21a8');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);

            // Add sparkles overlay on canvas
            ctx.fillStyle = '#ffffff33';
            for (let i = 0; i < 40; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const r = Math.random() * 2 + 1;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }

            // Text instruction on scratch card
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✨ Scratch Here to Reveal! ✨', width / 2, height / 2);
        }, 100);

        return () => clearTimeout(timer);
    }, [isOpen, userId]);

    // Scratching logic
    const checkScratchPercentage = (canvas, ctx) => {
        if (isScratched) return;
        const width = canvas.width;
        const height = canvas.height;
        const imgData = ctx.getImageData(0, 0, width, height);
        const pixels = imgData.data;
        let transparentPixels = 0;

        for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] === 0) {
                transparentPixels++;
            }
        }

        const percent = Math.round((transparentPixels / (pixels.length / 4)) * 100);
        setScratchPercent(percent);

        if (percent > 45 && !isScratched) {
            setIsScratched(true);
            setShowConfetti(true);
            const storageKey = `welcome_scratch_card_done_${userId}`;
            localStorage.setItem(storageKey, 'true');

            // Clear entire canvas smoothly
            ctx.clearRect(0, 0, width, height);
        }
    };

    const getTouchOrMousePos = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    };

    const startScratch = (e) => {
        if (isScratched) return;
        setIsDrawing(true);
        scratch(e);
    };

    const stopScratch = () => {
        setIsDrawing(false);
    };

    const scratch = (e) => {
        if (!isDrawing && e.type !== 'mousedown' && e.type !== 'touchstart') return;
        if (isScratched) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const pos = getTouchOrMousePos(e);

        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 24, 0, Math.PI * 2);
        ctx.fill();

        checkScratchPercentage(canvas, ctx);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
            {/* Confetti particles */}
            {showConfetti && <ConfettiCanvas />}

            <div
                ref={containerRef}
                className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 border border-purple-500/30 rounded-3xl p-6 shadow-2xl overflow-hidden text-center text-white animate-in zoom-in-95 duration-300"
            >
                {/* Background glow radial */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-500/30 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-20"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Top Badge & Header */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider mb-4 animate-bounce">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Welcome Surprise Gift
                </div>

                <h2 className="text-xl font-black tracking-tight text-white mb-1">
                    First Order Special Offer! 🎉
                </h2>
                <p className="text-xs font-medium text-purple-200/80 mb-6">
                    {isScratched ? "You've unlocked your exclusive reward!" : "Scratch the card below to reveal your welcome offer"}
                </p>

                {/* Scratch Card Outer Shell */}
                <div className="relative w-full h-56 rounded-2xl p-0.5 bg-gradient-to-tr from-amber-400 via-purple-400 to-amber-200 shadow-xl overflow-hidden mb-6">
                    {/* Underlying Gift Revealed Content */}
                    <div className="relative w-full h-full rounded-[14px] bg-gradient-to-br from-purple-900 via-slate-900 to-purple-950 p-5 flex flex-col items-center justify-center text-center">
                        <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-full mb-3 text-amber-400">
                            <Gift className="w-8 h-8 animate-pulse" />
                        </div>
                        <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-300">
                            {discountPercent}% OFF
                        </div>
                        {freeDelivery && (
                            <div className="text-xs font-black text-amber-400 uppercase tracking-widest mt-1">
                                + FREE Delivery on 1st Order!
                            </div>
                        )}
                        <p className="text-[11px] text-slate-300 mt-2 font-medium">
                            Auto-applied at checkout for your first purchase.
                        </p>
                    </div>

                    {/* Canvas Scratch Foil Overlay */}
                    {!isScratched && (
                        <canvas
                            ref={canvasRef}
                            onMouseDown={startScratch}
                            onMouseUp={stopScratch}
                            onMouseLeave={stopScratch}
                            onMouseMove={scratch}
                            onTouchStart={startScratch}
                            onTouchEnd={stopScratch}
                            onTouchMove={scratch}
                            className="absolute inset-0 w-full h-full cursor-pointer touch-none z-10 rounded-[14px]"
                        />
                    )}
                </div>

                {/* Footer Action */}
                {isScratched ? (
                    <button
                        onClick={onClose}
                        className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2"
                    >
                        <ShoppingBag className="w-4 h-4" />
                        Shop Now & Claim Gift
                    </button>
                ) : (
                    <div className="text-[11px] font-bold text-purple-300/60 uppercase tracking-widest flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Scratch to activate your 1st order offer
                    </div>
                )}
            </div>
        </div>
    );
};

// Lightweight canvas confetti burst
const ConfettiCanvas = () => {
    const ref = useRef(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const colors = ['#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#3b82f6', '#f43f5e'];
        const particles = Array.from({ length: 90 }, () => ({
            x: canvas.width / 2 + (Math.random() * 100 - 50),
            y: canvas.height / 2 + (Math.random() * 100 - 50),
            vx: (Math.random() - 0.5) * 14,
            vy: (Math.random() - 0.7) * 16,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 8 + 4,
            alpha: 1,
        }));

        let animationId;
        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = false;
            particles.forEach((p) => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.4; // gravity
                p.alpha -= 0.015;
                if (p.alpha > 0) {
                    alive = true;
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = p.alpha;
                    ctx.fillRect(p.x, p.y, p.size, p.size);
                }
            });
            if (alive) {
                animationId = requestAnimationFrame(render);
            }
        };

        render();
        return () => cancelAnimationFrame(animationId);
    }, []);

    return <canvas ref={ref} className="fixed inset-0 pointer-events-none z-50" />;
};

export default WelcomeScratchCardModal;
