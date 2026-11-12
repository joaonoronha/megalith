import React from "react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f8f8fa] flex flex-col items-center justify-center p-6 animate-fadeIn">
      {/* Centered minimalist branded loader */}
      <div className="flex flex-col items-center space-y-4">
        <div className="relative flex items-center justify-center">
          {/* Outer glowing pulsing ring */}
          <div className="w-16 h-16 rounded-full border-2 border-[#007aff]/20 animate-ping absolute" />
          
          {/* Modern spinning gradient ring */}
          <div className="w-12 h-12 rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff] border-r-[#5856d6] animate-spin" />
          
          {/* Inner CFM monogram dot */}
          <div className="w-4 h-4 rounded-full bg-[#111111] absolute flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        </div>

        {/* Text indicator */}
        <div className="text-center space-y-1">
          <p className="text-[13px] font-semibold text-[#111111] tracking-tight">
            CFM Events
          </p>
          <p className="text-[11px] text-[#8e8e93]">
            A carregar...
          </p>
        </div>
      </div>
    </div>
  );
}
