import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  ArrowRight,
  UserPlus,
  Users,
  ShoppingBag,
  Coins,
  FileEdit,
  TrendingUp,
  Award,
  Wallet,
  Gift,
} from "lucide-react";
import { motion } from "framer-motion";
import { useSettings } from "@/core/context/SettingsContext";
import { cn } from "@/lib/utils";

// Icon resolver helper
const resolveStepIcon = (iconType) => {
  switch (String(iconType || "").toLowerCase()) {
    case "edit":
    case "register":
    case "fileedit":
      return <FileEdit className="w-5 h-5 md:w-6 md:h-6 text-orange-500" strokeWidth={2.2} />;
    case "users":
    case "refer":
    case "network":
      return <Users className="w-5 h-5 md:w-6 md:h-6 text-orange-500" strokeWidth={2.2} />;
    case "bag":
    case "shop":
    case "shoppingbag":
      return <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-orange-500" strokeWidth={2.2} />;
    case "income":
    case "coins":
    case "money":
    case "wallet":
      return <Coins className="w-5 h-5 md:w-6 md:h-6 text-orange-500" strokeWidth={2.2} />;
    case "gift":
      return <Gift className="w-5 h-5 md:w-6 md:h-6 text-orange-500" strokeWidth={2.2} />;
    case "trending":
      return <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-orange-500" strokeWidth={2.2} />;
    default:
      return <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-orange-500" strokeWidth={2.2} />;
  }
};

const MlmPromotionalBanner = ({ className = "" }) => {
  const navigate = useNavigate();
  const { settings } = useSettings();

  const mlmConfig = settings?.mlmPromo || {
    enabled: true,
    badgeText: "SEVAFAST MLM",
    title: "JOIN SEVAFAST MULTI LEVEL MARKETING",
    subtitle: "Earn More, Refer More, Grow Your Network!",
    ctaText: "JOIN NOW",
    ctaLink: "/plans",
    bannerBgColor: "#FFF6F0",
    customImageUrl: "",
    steps: [
      { stepNumber: 1, title: "Register Free", subtitle: "Instant Activation", iconType: "edit" },
      { stepNumber: 2, title: "Refer Your Friends", subtitle: "Share Referral Code", iconType: "users" },
      { stepNumber: 3, title: "They Shop, You Earn", subtitle: "Direct & Team Commissions", iconType: "bag" },
      { stepNumber: 4, title: "Unlimited Income", subtitle: "Multi-Level Growth", iconType: "income" },
    ],
  };

  if (mlmConfig.enabled === false) {
    return null;
  }

  const steps = mlmConfig.steps?.length
    ? mlmConfig.steps
    : [
        { stepNumber: 1, title: "Register Free", subtitle: "Instant Activation", iconType: "edit" },
        { stepNumber: 2, title: "Refer Your Friends", subtitle: "Share Referral Code", iconType: "users" },
        { stepNumber: 3, title: "They Shop, You Earn", subtitle: "Direct & Team Commissions", iconType: "bag" },
        { stepNumber: 4, title: "Unlimited Income", subtitle: "Multi-Level Growth", iconType: "income" },
      ];

  const handleCtaClick = (e) => {
    e.stopPropagation();
    const targetLink = mlmConfig.ctaLink || "/plans";
    if (targetLink.startsWith("http://") || targetLink.startsWith("https://")) {
      window.open(targetLink, "_blank", "noopener,noreferrer");
    } else {
      navigate(targetLink);
    }
  };

  return (
    <div className={cn("w-full my-4 sm:my-6 select-none", className)}>
      {/* Outer Banner Card */}
      <div
        onClick={handleCtaClick}
        className="group relative w-full rounded-2xl md:rounded-[28px] overflow-hidden border border-orange-200/70 shadow-[0_10px_35px_rgba(249,115,22,0.1)] hover:shadow-[0_16px_45px_rgba(249,115,22,0.18)] transition-all duration-300 cursor-pointer"
        style={{
          background:
            "linear-gradient(135deg, #FFF7F2 0%, #FFEEE4 45%, #FFE5D4 100%)",
        }}
      >
        {/* Subtle Ambient Glow Layers */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-gradient-to-br from-orange-300/25 to-amber-200/0 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-72 h-72 bg-gradient-to-tr from-amber-400/20 to-orange-200/0 rounded-full blur-2xl pointer-events-none" />

        {/* If Admin uploaded a custom full banner image */}
        {mlmConfig.customImageUrl ? (
          <div className="relative w-full">
            <img
              src={mlmConfig.customImageUrl}
              alt={mlmConfig.title || "MLM Promotion"}
              className="w-full h-auto object-cover max-h-[260px] md:max-h-[300px]"
            />
            <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-10">
              <button
                onClick={handleCtaClick}
                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs md:text-sm rounded-full shadow-lg hover:shadow-orange-500/40 transition-all flex items-center gap-1.5 active:scale-95"
              >
                {mlmConfig.ctaText || "JOIN NOW"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="relative z-10 px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-7 lg:px-10 lg:py-8 flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8">
            
            {/* Left Col: Headings & CTA */}
            <div className="flex-1 text-center lg:text-left space-y-2.5 md:space-y-3.5 max-w-lg">
              {mlmConfig.badgeText && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-700 text-[10px] md:text-xs font-black tracking-wider uppercase backdrop-blur-sm">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                  {mlmConfig.badgeText}
                </div>
              )}

              <h2 className="text-lg sm:text-xl md:text-2xl lg:text-[26px] font-black text-slate-900 leading-[1.2] tracking-tight uppercase">
                {mlmConfig.title || "JOIN SEVAFAST MULTI LEVEL MARKETING"}
              </h2>

              <p className="text-xs sm:text-sm md:text-[15px] font-semibold text-slate-700 leading-snug">
                {mlmConfig.subtitle || "Earn More, Refer More, Grow Your Network!"}
              </p>

              <div className="pt-1.5 flex items-center justify-center lg:justify-start">
                <button
                  onClick={handleCtaClick}
                  className="px-6 py-2.5 md:px-7 md:py-3 bg-gradient-to-r from-[#FF6B00] via-[#FF7A00] to-[#FF9E00] hover:from-[#EA580C] hover:to-[#F59E0B] text-white font-extrabold text-xs sm:text-sm tracking-wider uppercase rounded-xl md:rounded-2xl shadow-[0_6px_20px_rgba(255,107,0,0.35)] group-hover:shadow-[0_8px_25px_rgba(255,107,0,0.5)] transition-all duration-300 flex items-center gap-2 active:scale-95 cursor-pointer"
                >
                  <span>{mlmConfig.ctaText || "JOIN NOW"}</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </div>
            </div>

            {/* Center Col: Process Steps */}
            <div className="w-full lg:w-auto flex-1 flex items-center justify-center">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 md:gap-6 w-full max-w-xl">
                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center text-center group/step transition-transform duration-200 hover:-translate-y-1"
                  >
                    {/* Circle Icon Badge */}
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-white border-2 border-orange-200/80 shadow-[0_4px_14px_rgba(249,115,22,0.12)] flex items-center justify-center mb-2 transition-all duration-200 group-hover/step:border-orange-500 group-hover/step:shadow-[0_6px_20px_rgba(249,115,22,0.25)]">
                      {resolveStepIcon(step.iconType)}
                      <span className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full bg-orange-500 text-white text-[9px] md:text-[10px] font-black flex items-center justify-center shadow-sm">
                        {step.stepNumber || idx + 1}
                      </span>
                    </div>

                    {/* Step Title */}
                    <h4 className="text-[11px] sm:text-xs md:text-[13px] font-black text-slate-800 leading-tight">
                      {step.title}
                    </h4>

                    {/* Step Subtitle (optional) */}
                    {step.subtitle && (
                      <p className="text-[9px] sm:text-[10px] md:text-[11px] font-medium text-slate-500 mt-0.5 hidden sm:block line-clamp-1">
                        {step.subtitle}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right Col: Graphic Network & Rising Wealth Illustration */}
            <div className="shrink-0 hidden xl:flex items-center justify-end relative w-48 h-32 md:w-56 md:h-36">
              <svg
                viewBox="0 0 240 160"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full overflow-visible drop-shadow-md"
              >
                {/* Network Connection Lines */}
                <g stroke="#FDBA74" strokeWidth="2" strokeDasharray="3 3" opacity="0.8">
                  <line x1="45" y1="45" x2="90" y2="25" />
                  <line x1="45" y1="45" x2="95" y2="75" />
                  <line x1="90" y1="25" x2="140" y2="20" />
                  <line x1="95" y1="75" x2="145" y2="65" />
                  <line x1="95" y1="75" x2="105" y2="125" />
                </g>

                {/* Network Avatar Nodes */}
                {/* Node 1 - Leader */}
                <g transform="translate(30, 30)">
                  <circle cx="15" cy="15" r="16" fill="#EA580C" />
                  <circle cx="15" cy="15" r="14" fill="#FED7AA" />
                  <circle cx="15" cy="11" r="5" fill="#9A3412" />
                  <path d="M7 23 C7 18, 23 18, 23 23" fill="#9A3412" />
                </g>

                {/* Node 2 */}
                <g transform="translate(76, 10)">
                  <circle cx="14" cy="14" r="14" fill="#F97316" />
                  <circle cx="14" cy="14" r="12" fill="#FFEDD5" />
                  <circle cx="14" cy="11" r="4" fill="#C2410C" />
                  <path d="M7 21 C7 17, 21 17, 21 21" fill="#C2410C" />
                </g>

                {/* Node 3 */}
                <g transform="translate(81, 60)">
                  <circle cx="14" cy="14" r="14" fill="#F97316" />
                  <circle cx="14" cy="14" r="12" fill="#FFEDD5" />
                  <circle cx="14" cy="11" r="4" fill="#0284C7" />
                  <path d="M7 21 C7 17, 21 17, 21 21" fill="#0284C7" />
                </g>

                {/* Node 4 */}
                <g transform="translate(91, 110)">
                  <circle cx="14" cy="14" r="14" fill="#FB923C" />
                  <circle cx="14" cy="14" r="12" fill="#FEF3C7" />
                  <circle cx="14" cy="11" r="4" fill="#16A34A" />
                  <path d="M7 21 C7 17, 21 17, 21 21" fill="#16A34A" />
                </g>

                {/* Rising Exponential Curve Arrow */}
                <path
                  d="M 60 135 Q 150 130 215 25"
                  fill="none"
                  stroke="url(#arrowGrad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Arrowhead */}
                <polygon
                  points="215,10 230,28 206,32"
                  fill="#EA580C"
                  filter="drop-shadow(0 2px 4px rgba(234,88,12,0.4))"
                />

                {/* Coin Stack 1 */}
                <g transform="translate(145, 120)">
                  <ellipse cx="10" cy="16" rx="10" ry="4" fill="#D97706" />
                  <rect x="0" y="8" width="20" height="8" fill="#F59E0B" />
                  <ellipse cx="10" cy="8" rx="10" ry="4" fill="#FCD34D" />
                </g>

                {/* Coin Stack 2 */}
                <g transform="translate(168, 98)">
                  <ellipse cx="10" cy="28" rx="10" ry="4" fill="#D97706" />
                  <rect x="0" y="8" width="20" height="20" fill="#F59E0B" />
                  <ellipse cx="10" cy="8" rx="10" ry="4" fill="#FCD34D" />
                </g>

                {/* Coin Stack 3 (Taller) */}
                <g transform="translate(191, 72)">
                  <ellipse cx="11" cy="44" rx="11" ry="4.5" fill="#B45309" />
                  <rect x="0" y="8" width="22" height="36" fill="#F59E0B" />
                  <ellipse cx="11" cy="8" rx="11" ry="4.5" fill="#FDE047" />
                  <ellipse cx="11" cy="8" rx="8" ry="3" fill="#FEF08A" />
                </g>

                {/* Coin Stack 4 (Tallest peak) */}
                <g transform="translate(215, 45)">
                  <ellipse cx="11" cy="60" rx="11" ry="4.5" fill="#B45309" />
                  <rect x="0" y="8" width="22" height="52" fill="#F59E0B" />
                  <ellipse cx="11" cy="8" rx="11" ry="4.5" fill="#FEF08A" />
                  <ellipse cx="11" cy="8" rx="8" ry="3" fill="#FFFFFF" />
                </g>

                {/* Sparkle Stars */}
                <polygon points="135,45 138,52 145,55 138,58 135,65 132,58 125,55 132,52" fill="#F59E0B" />
                <polygon points="225,18 227,22 231,24 227,26 225,30 223,26 219,24 223,22" fill="#FDE047" />

                {/* Gradients */}
                <defs>
                  <linearGradient id="arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#F97316" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#EA580C" />
                    <stop offset="100%" stopColor="#C2410C" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default MlmPromotionalBanner;
