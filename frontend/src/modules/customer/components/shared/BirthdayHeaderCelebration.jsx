import React, { useEffect, useMemo } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { useAuth } from "@core/context/AuthContext";
import { getBirthdayFirstName, isBirthdayToday } from "@shared/utils/birthdayUtils";

const CONFETTI_COLORS = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF61D8", "#FFFFFF"];

function fireHeaderConfetti() {
  confetti({
    particleCount: 55,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.12 },
    colors: CONFETTI_COLORS,
    ticks: 200,
    gravity: 0.9,
    scalar: 0.9,
    zIndex: 9999,
  });
  confetti({
    particleCount: 55,
    angle: 120,
    spread: 55,
    origin: { x: 1, y: 0.12 },
    colors: CONFETTI_COLORS,
    ticks: 200,
    gravity: 0.9,
    scalar: 0.9,
    zIndex: 9999,
  });
  confetti({
    particleCount: 35,
    spread: 80,
    origin: { x: 0.5, y: 0.08 },
    colors: CONFETTI_COLORS,
    ticks: 180,
    gravity: 0.85,
    scalar: 0.75,
    zIndex: 9999,
  });
}

const BirthdayHeaderCelebration = ({ variant = "global" }) => {
  const { user, isAuthenticated } = useAuth();
  const isBirthday = useMemo(
    () => isAuthenticated && isBirthdayToday(user?.dateOfBirth),
    [isAuthenticated, user?.dateOfBirth],
  );
  const firstName = getBirthdayFirstName(user?.name);

  useEffect(() => {
    if (!isBirthday || variant !== "global") return undefined;

    fireHeaderConfetti();
    const intervalId = setInterval(fireHeaderConfetti, 14000);
    return () => clearInterval(intervalId);
  }, [isBirthday, variant]);

  if (!isBirthday) return null;

  if (variant === "inline") {
    return (
      <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-3 top-[72px] text-xl sm:text-2xl drop-shadow-md"
          aria-hidden
        >
          🎉
        </motion.span>
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="absolute right-[4.5rem] top-[68px] text-xl sm:text-2xl drop-shadow-md"
          aria-hidden
        >
          🎊
        </motion.span>
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="absolute left-1/2 top-14 sm:top-16 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/50 bg-white/95 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:px-4 sm:text-[11px]"
        >
          🎂 Happy Birthday, {firstName}!
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[9998] h-9 bg-gradient-to-r from-pink-500 via-amber-400 to-violet-500 shadow-md">
      <div className="flex h-full items-center justify-center gap-2 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-white sm:text-[11px]">
        <span className="animate-bounce">🎉</span>
        <span>Happy Birthday, {firstName}!</span>
        <span className="animate-bounce [animation-delay:150ms]">🎂</span>
      </div>
    </div>
  );
};

export default BirthdayHeaderCelebration;
