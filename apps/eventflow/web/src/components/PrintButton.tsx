"use client";

import React from "react";
import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] bg-white border border-[#ececf0] text-xs font-semibold text-[#111111] hover:bg-[#f8f8fa] transition shadow-xs cursor-pointer print:hidden"
    >
      <Printer className="w-3.5 h-3.5 text-[#6e6e73]" />
      <span>Imprimir / Guardar PDF</span>
    </button>
  );
}
