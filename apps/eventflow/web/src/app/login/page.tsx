"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/app/actions";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("password", password);

      const res = await loginAction(formData);
      if (res.success) {
        router.push("/");
        router.refresh();
      } else {
        setError(res.error || "Credenciais inválidas.");
      }
    } catch (err: any) {
      setError(err?.message || "Ocorreu um erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4 antialiased text-[#111111]">
      <div className="w-full max-w-sm bg-white border border-[#ececf0] rounded-[24px] p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        {/* Brand / Logo */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-[16px] bg-[#111111] text-white flex items-center justify-center font-black text-base tracking-tighter mb-3 shadow-xs">
            EF
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#111111]">
            EventFlow
          </h1>
          <p className="text-xs text-[#8e8e93] mt-0.5">
            CFM Eventos · Plataforma de Gestão
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#3a3a3c] mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@cfmeventos.pt"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#ececf0] rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-[#3a3a3c]">
                Palavra-passe
              </label>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#ececf0] rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-[14px] bg-[#111111] hover:bg-black text-white text-xs font-bold transition shadow-xs mt-2 disabled:opacity-60"
          >
            {isLoading ? "A verificar..." : "Entrar na Plataforma"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#ececf0] text-center text-[11px] text-[#8e8e93]">
          Acesso restrito à equipa autorizada da CFM Eventos.
        </div>
      </div>
    </div>
  );
}
