import React from "react";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function EventDetailLoading() {
  return (
    <div className="min-h-screen bg-[#f8f8fa] text-[#111111] animate-fadeIn pb-24">
      {/* Sticky Header Skeleton */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-[#ececf0] transition">
        <div className="max-w-[1100px] mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#f2f2f5] border border-[#ececf0] flex items-center justify-center text-[#8e8e93]">
              <ArrowLeft className="w-4 h-4 opacity-40" />
            </div>
            <div className="h-4 w-28 bg-[#f2f2f5] rounded-full animate-pulse" />
          </div>

          <div className="flex items-center gap-2">
            <div className="h-7 w-20 bg-[#f2f2f5] rounded-full animate-pulse hidden sm:block" />
            <div className="w-7 h-7 rounded-full bg-[#f2f2f5] animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1100px] mx-auto px-4 pt-6 space-y-6">
        {/* HERO SKELETON */}
        <section className="bg-white border border-[#ececf0] rounded-[24px] shadow-xs overflow-hidden">
          <div className="relative min-h-[240px] md:min-h-[280px] w-full bg-neutral-900/80 p-6 rounded-t-[24px] flex flex-col justify-between overflow-hidden">
            {/* Shimmer gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 animate-pulse" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

            {/* Top row pills */}
            <div className="relative z-10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-32 bg-white/20 backdrop-blur-md rounded-full animate-pulse" />
                <div className="h-6 w-24 bg-white/15 backdrop-blur-md rounded-full animate-pulse hidden sm:block" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-20 bg-white/20 backdrop-blur-md rounded-full animate-pulse" />
              </div>
            </div>

            {/* Bottom Hero Info */}
            <div className="relative z-10 space-y-3">
              <div className="h-8 w-64 sm:w-80 bg-white/30 backdrop-blur-md rounded-xl animate-pulse" />
              <div className="flex items-center gap-2.5">
                <div className="h-4 w-36 bg-white/20 backdrop-blur-md rounded-full animate-pulse" />
                <div className="h-4 w-4 bg-white/10 rounded-full" />
                <div className="h-4 w-28 bg-white/20 backdrop-blur-md rounded-full animate-pulse" />
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar Skeleton */}
          <div className="p-4 sm:p-5 bg-white border-t border-[#ececf0] grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3 rounded-2xl bg-[#f8f8fa] border border-[#ececf0] space-y-2">
                <div className="h-3 w-16 bg-[#ececf0] rounded-full animate-pulse" />
                <div className="h-6 w-20 bg-[#e5e5ea] rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        </section>

        {/* Navigation Tabs Bar Skeleton */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[100, 120, 90, 130, 80].map((width, idx) => (
            <div
              key={idx}
              style={{ width: `${width}px` }}
              className="h-9 rounded-full bg-white border border-[#ececf0] shadow-2xs flex-shrink-0 animate-pulse"
            />
          ))}
        </div>

        {/* Content Section Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-xs space-y-3">
              <div className="h-5 w-40 bg-[#e5e5ea] rounded-lg animate-pulse" />
              <div className="h-20 w-full bg-[#f8f8fa] rounded-xl border border-[#ececf0] animate-pulse" />
            </div>
            <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-xs space-y-3">
              <div className="h-5 w-48 bg-[#e5e5ea] rounded-lg animate-pulse" />
              <div className="h-36 w-full bg-[#f8f8fa] rounded-xl border border-[#ececf0] animate-pulse" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-xs space-y-3">
              <div className="h-5 w-32 bg-[#e5e5ea] rounded-lg animate-pulse" />
              <div className="h-28 w-full bg-[#f8f8fa] rounded-xl border border-[#ececf0] animate-pulse" />
            </div>
          </div>
        </div>
      </main>

      {/* Floating loading toast indicator */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div className="px-4 py-2 rounded-full bg-[#111111]/90 backdrop-blur-md text-white text-xs font-semibold shadow-xl border border-white/10 flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <span>A carregar evento...</span>
        </div>
      </div>
    </div>
  );
}
