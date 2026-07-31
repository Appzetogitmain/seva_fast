import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import comingSoonAnimation from '@/assets/lottie/Coming soon (2).json';

const ServiceUnavailableSection = ({
    embedded = false,
    title = 'Service',
    description = "Ah! We haven't reached your neighborhood yet.",
    buttonLabel = 'Check Again',
    onRetry,
    showHomeButton = false,
    secondaryButtonLabel,
    onSecondaryClick,
}) => {
    const navigate = useNavigate();
    const animationData = useMemo(() => comingSoonAnimation, []);

    const handleRetry = () => {
        if (onRetry) {
            onRetry();
            return;
        }
        window.location.reload();
    };

    const content = (
        <>
            <div className="mx-auto w-full max-w-[260px] sm:max-w-[320px]">
                <Lottie
                    animationData={animationData}
                    loop
                    className="w-full h-auto"
                />
            </div>

            <h3 className="mt-2 text-3xl md:text-5xl font-black text-slate-800 text-center uppercase tracking-tight">
                {title} <span className="text-primary">Unavailable</span>
            </h3>

            <p className="mt-4 text-slate-500 font-bold max-w-md text-center px-6 text-sm md:text-lg opacity-80 leading-relaxed">
                {description}
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                    type="button"
                    onClick={handleRetry}
                    className="px-10 py-4 bg-primary text-white font-black rounded-[24px] uppercase text-[13px] tracking-widest transition-all active:scale-95 hover:brightness-105 shadow-lg shadow-primary/20"
                >
                    {buttonLabel}
                </button>

                {showHomeButton && (
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="px-10 py-4 bg-white border border-slate-200 text-slate-700 font-black rounded-[24px] uppercase text-[13px] tracking-widest transition-all active:scale-95 hover:bg-slate-50"
                    >
                        Back to Home
                    </button>
                )}

                {secondaryButtonLabel && (
                    <button
                        type="button"
                        onClick={onSecondaryClick || (() => navigate(-1))}
                        className="px-10 py-4 bg-white border border-slate-200 text-slate-700 font-black rounded-[24px] uppercase text-[13px] tracking-widest transition-all active:scale-95 hover:bg-slate-50"
                    >
                        {secondaryButtonLabel}
                    </button>
                )}
            </div>
        </>
    );

    if (embedded) {
        return (
            <div className="flex flex-col items-center justify-center pt-8 pb-48 px-4 w-full">
                {content}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-outfit">
            <div className="w-full max-w-2xl rounded-3xl bg-white border border-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6 md:p-10 text-center flex flex-col items-center">
                {content}
            </div>
        </div>
    );
};

export default ServiceUnavailableSection;
