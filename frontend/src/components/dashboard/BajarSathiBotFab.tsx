"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, X, MessageSquareHeart } from "lucide-react";

interface BajarSathiBotFabProps {
  onClick: () => void;
  hasData?: boolean;
}

export function BajarSathiBotFab({ onClick, hasData = false }: BajarSathiBotFabProps) {
  const [showBubble, setShowBubble] = useState(true);
  const [isWiggling, setIsWiggling] = useState(false);

  // Auto-hide bubble after 10 seconds to keep mobile screen clean
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowBubble(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  // Periodic cute wiggle every 8 seconds to catch attention
  useEffect(() => {
    const interval = setInterval(() => {
      setIsWiggling(true);
      setTimeout(() => setIsWiggling(false), 1200);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-3.5 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end pointer-events-none select-none">
      {/* Friendly Speech Bubble Above Bot */}
      {showBubble && (
        <div className="pointer-events-auto mb-2.5 mr-1 max-w-[210px] sm:max-w-[250px] bg-slate-900/95 text-slate-100 border border-emerald-500/40 rounded-2xl p-2.5 sm:p-3 shadow-2xl shadow-emerald-950/60 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300 relative group">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowBubble(false);
            }}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-[10px] transition shadow"
            title="बन्द गर्नुहोस्"
            aria-label="Dismiss message"
          >
            <X className="w-3 h-3" />
          </button>

          <div className="flex items-start gap-2">
            <span className="text-base sm:text-lg animate-bounce shrink-0">👋</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] sm:text-xs font-bold text-emerald-400 flex items-center gap-1">
                नमस्ते! म बजारको साथी
                <Sparkles className="w-3 h-3 text-amber-400 inline" />
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-300 mt-0.5 leading-tight">
                {hasData
                  ? "तपाईंको पसलको नाफा, बिक्री वा स्टक सोध्नुहोस्!"
                  : "पसलको हिसाब र व्यापार सोधपुछ गर्न मलाई थिच्नुहोस्!"}
              </p>
            </div>
          </div>

          {/* Speech Bubble Arrow Downward pointing to Bot */}
          <div className="absolute -bottom-1.5 right-6 sm:right-8 w-3 h-3 bg-slate-900 border-r border-b border-emerald-500/40 rotate-45" />
        </div>
      )}

      {/* The Sano Bot Mascot Interactive Button */}
      <button
        onClick={onClick}
        className="pointer-events-auto group relative flex items-center gap-2.5 p-2 sm:p-2.5 rounded-full sm:rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/90 border border-emerald-500/40 hover:border-emerald-400 shadow-2xl shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-95 transition-all duration-300"
        title="बजारको साथी AI (सोधपुछ गर्नुहोस्)"
        aria-label="Open Bajar ko Sathi AI Assistant"
      >
        {/* Neon Glow Aura Behind Bot */}
        <span className="absolute -inset-1 rounded-full sm:rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 opacity-25 group-hover:opacity-60 blur-md transition duration-500 animate-pulse pointer-events-none" />

        {/* 3D Stylized Sano Bot Mascot Face */}
        <div
          className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-700 p-0.5 shadow-inner transition-transform duration-500 ${
            isWiggling ? "animate-bounce" : "group-hover:rotate-6"
          }`}
        >
          {/* Bot Antenna */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
            <div className="w-2 h-2 rounded-full bg-amber-400 shadow-lg shadow-amber-400/80 animate-ping" />
            <div className="w-0.5 h-1.5 bg-slate-300" />
          </div>

          {/* Bot Face Screen (Dark Glossy Glass) */}
          <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center p-1.5 overflow-hidden border border-emerald-400/30">
            {/* Glowing Cyan LED Eyes */}
            <div className="flex items-center gap-1.5 sm:gap-2 my-0.5">
              <div className="w-2 h-2.5 sm:w-2.5 sm:h-3 rounded-full bg-cyan-400 shadow-md shadow-cyan-400/90 animate-pulse" />
              <div className="w-2 h-2.5 sm:w-2.5 sm:h-3 rounded-full bg-cyan-400 shadow-md shadow-cyan-400/90 animate-pulse" />
            </div>

            {/* Happy Little Smile */}
            <div className="w-3.5 h-1 border-b-2 border-emerald-400 rounded-full mt-0.5" />
          </div>

          {/* Online Indicator Dot on Bot Ear */}
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          </div>
        </div>

        {/* Bot Name & Identity Tag (Clean pill on mobile, full tag on sm+) */}
        <div className="hidden sm:flex flex-col text-left pr-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-white tracking-tight group-hover:text-emerald-300 transition-colors">
              बजारको साथी AI
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              Bot
            </span>
          </div>
          <span className="text-[10px] text-slate-300 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
            नेपाली व्यापार सल्लाहकार
          </span>
        </div>

        {/* Mobile Mini Badge Label */}
        <div className="sm:hidden pr-1 text-left">
          <span className="text-[11px] font-black text-white block leading-tight">
            AI साथी
          </span>
          <span className="text-[9px] text-emerald-400 block font-semibold leading-none">
            ● अनलाइन
          </span>
        </div>
      </button>
    </div>
  );
}
