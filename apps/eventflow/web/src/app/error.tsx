"use client";

import React, { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error cleanly for client-side diagnostics
    console.error("EventFlow runtime error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#f8f8fa] flex items-center justify-center p-6 antialiased text-[#111111]">
      <div className="w-full max-w-md bg-white border border-[#ececf0] rounded-[24px] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] text-center">
        <div className="w-14 h-14 rounded-[18px] bg-rose-50 text-rose-600 border border-rose-200/60 mx-auto flex items-center justify-center mb-5">
          <AlertCircle className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-bold tracking-tight text-[#111111] mb-2">
          Ocorreu um erro inesperado
        </h1>

        <p className="text-xs text-[#8e8e93] leading-relaxed mb-6">
          A plataforma encontrou um problema ao carregar os dados. Podes tentar recarregar ou voltar à página principal.
        </p>

        {error.digest && (
          <div className="mb-6 p-2.5 rounded-[12px] bg-[#f8f8fa] border border-[#ececf0] text-[11px] font-mono text-[#8e8e93] select-all">
            Digest: {error.digest}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[14px] bg-[#111111] hover:bg-black text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar novamente</span>
          </button>

          <Link
            href="/"
            onClick={() => {
              window.location.href = "/";
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[14px] bg-white border border-[#ececf0] hover:bg-[#f2f2f5] text-[#111111] text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Página Principal</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
