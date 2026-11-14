import React from "react";
import { ArrowLeft } from "lucide-react";

export default function InventoryDetailLoading() {
  return (
    <div className="min-h-screen bg-[#f8f8fa] text-[#111111] animate-fadeIn pb-24">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-[#ececf0]">
        <div className="max-w-[1000px] mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#f2f2f5] border border-[#ececf0] flex items-center justify-center text-[#8e8e93]">
              <ArrowLeft className="w-4 h-4 opacity-40" />
            </div>
            <div className="h-4 w-24 bg-[#f2f2f5] rounded-full animate-pulse" />
          </div>
          <div className="h-7 w-20 bg-[#f2f2f5] rounded-full animate-pulse" />
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1000px] mx-auto px-4 pt-6 space-y-6">
        <section className="bg-white border border-[#ececf0] rounded-[24px] p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="w-28 h-28 rounded-2xl bg-[#f2f2f5] animate-pulse flex-shrink-0" />
            <div className="space-y-3 flex-1">
              <div className="h-4 w-28 bg-[#f2f2f5] rounded-full animate-pulse" />
              <div className="h-7 w-60 bg-[#e5e5ea] rounded-xl animate-pulse" />
              <div className="h-4 w-40 bg-[#f2f2f5] rounded-full animate-pulse" />
            </div>
          </div>
        </section>
      </main>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div className="px-4 py-2 rounded-full bg-[#111111]/90 backdrop-blur-md text-white text-xs font-semibold shadow-xl border border-white/10 flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <span>A carregar artigo...</span>
        </div>
      </div>
    </div>
  );
}
