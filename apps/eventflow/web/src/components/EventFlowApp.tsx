"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { createEventAction, createQuoteAction } from "@/app/actions";

interface Props {
  initialEvents: any[];
  initialItems: any[];
  initialClients: any[];
  initialQuotes: any[];
  initialMovements: any[];
  initialTemplate: any;
}

export default function EventFlowApp({
  initialEvents,
  initialItems,
  initialClients,
  initialQuotes,
  initialMovements,
  initialTemplate,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    "home" | "calendar" | "events" | "inventory" | "more"
  >("home");

  const [eventsList, setEventsList] = useState(initialEvents);
  const [quotesList, setQuotesList] = useState(initialQuotes);

  // Wizard Modals
  const [showEventWizard, setShowEventWizard] = useState(false);
  const [showQuoteWizard, setShowQuoteWizard] = useState(false);

  // Selected calendar day
  const [selectedDay, setSelectedDay] = useState(30);

  // Financial aggregates
  const totalEntradas = initialMovements
    .filter((m) => m.type === "entrada")
    .reduce((sum, m) => sum + m.amount, 0);

  const totalSaidas = initialMovements
    .filter((m) => m.type === "saida")
    .reduce((sum, m) => sum + m.amount, 0);

  const totalInvestido = initialMovements
    .filter((m) => m.type === "investimento")
    .reduce((sum, m) => sum + m.amount, 0);

  const resultadoLiquido = totalEntradas - totalSaidas - totalInvestido;

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#111111] pb-28 font-sans antialiased">
      {/* Main Content Area */}
      <main className="max-w-[940px] mx-auto px-4 pt-8 pb-10">
        {/* TAB 1: HOME */}
        {activeTab === "home" && (
          <section className="space-y-4">
            {/* Header Greeting */}
            <div className="mb-4">
              <h1 className="text-[36px] sm:text-[39px] font-extrabold tracking-[-1.5px] text-[#111111] leading-none mb-3.5">
                Olá CFM Eventos.
              </h1>

              {/* Search bar matching prototype */}
              <div className="w-full max-w-[720px] h-[50px] bg-white border border-[#ececf0] rounded-[15px] px-4 flex items-center gap-3 shadow-[0_1px_0_rgba(0,0,0,0.015)]">
                <span className="text-[19px] text-[#6e6e73]">⌕</span>
                <input
                  type="text"
                  placeholder="Pesquisar artigos, eventos, clientes..."
                  className="w-full text-[14px] text-[#111111] placeholder-[#8e8e93] bg-transparent outline-none"
                />
              </div>

              {/* CTAs right under search */}
              <div className="flex flex-wrap items-center gap-2.5 mt-3">
                <button
                  onClick={() => setShowEventWizard(true)}
                  className="min-h-[44px] px-4 py-2.5 rounded-[12px] bg-[#111111] hover:bg-black text-white text-[13px] font-semibold flex items-center gap-1.5 transition shadow-xs"
                >
                  <span className="text-base font-normal leading-none">＋</span>
                  <span>Novo evento</span>
                </button>

                <button
                  onClick={() => setShowQuoteWizard(true)}
                  className="min-h-[44px] px-4 py-2.5 rounded-[12px] bg-white border border-black/10 hover:bg-[#f8f8fa] text-[#111111] text-[13px] font-semibold flex items-center gap-1.5 transition shadow-xs"
                >
                  <span className="text-base font-normal leading-none">＋</span>
                  <span>Novo orçamento</span>
                </button>
              </div>
            </div>

            {/* Resumo Financeiro Card */}
            <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
              {/* Head */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[18px] font-bold tracking-[-0.35px] text-[#111111]">
                    Resumo financeiro
                  </div>
                  <div className="text-[12px] text-[#8e8e93]">
                    Outubro 2026 · valores demonstrativos
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setActiveTab("more")}
                    className="text-[13px] font-semibold text-[#007aff] hover:underline"
                  >
                    Ver detalhe →
                  </button>
                  <button
                    onClick={() => setShowEventWizard(true)}
                    className="w-[34px] h-[34px] rounded-full bg-[#1c1c1e] text-white flex items-center justify-center font-bold text-base hover:bg-black transition shadow-xs"
                    aria-label="Adicionar"
                  >
                    ＋
                  </button>
                </div>
              </div>

              {/* 4 Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-[#f7f7f9] border border-black/[0.035] rounded-[16px] p-3.5">
                  <div className="text-[12px] text-[#8e8e93] mb-1.5">Entradas</div>
                  <div className="text-[24px] font-bold tracking-[-0.7px] text-[#217a3b]">
                    €12.450
                  </div>
                  <div className="text-[11px] text-[#8e8e93] mt-1">Recebido este mês</div>
                </div>

                <div className="bg-[#f7f7f9] border border-black/[0.035] rounded-[16px] p-3.5">
                  <div className="text-[12px] text-[#8e8e93] mb-1.5">Saídas</div>
                  <div className="text-[24px] font-bold tracking-[-0.7px] text-[#b04a3f]">
                    €4.380
                  </div>
                  <div className="text-[11px] text-[#8e8e93] mt-1">Despesas operacionais</div>
                </div>

                <div className="bg-[#f7f7f9] border border-black/[0.035] rounded-[16px] p-3.5">
                  <div className="text-[12px] text-[#8e8e93] mb-1.5">Investido</div>
                  <div className="text-[24px] font-bold tracking-[-0.7px] text-[#8c6417]">
                    €2.150
                  </div>
                  <div className="text-[11px] text-[#8e8e93] mt-1">Material e equipamento</div>
                </div>

                <div className="bg-[#f7f7f9] border border-black/[0.035] rounded-[16px] p-3.5">
                  <div className="text-[12px] text-[#8e8e93] mb-1.5">Resultado líquido</div>
                  <div className="text-[24px] font-bold tracking-[-0.7px] text-[#111111]">
                    €5.920
                  </div>
                  <div className="text-[11px] text-[#8e8e93] mt-1">
                    Entradas − saídas − investimento
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-[#ececf0] pt-3.5 mt-3.5 text-[12px] text-[#8e8e93]">
                <div>
                  Faturado <strong className="text-[#111111] font-semibold">€15.650</strong> · A
                  receber <strong className="text-[#111111] font-semibold">€3.200</strong>
                </div>
                <div>
                  Margem operacional{" "}
                  <strong className="text-[#111111] font-semibold">47,6%</strong>
                </div>
              </div>
            </div>

            {/* Layout Grid: Left Stack (2/3) + Right Stack (1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
              {/* LEFT STACK (2/3 width = 8 cols) */}
              <div className="lg:col-span-7 space-y-3.5">
                {/* CARD 1: Próximos eventos */}
                <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[18px] font-bold tracking-[-0.35px] text-[#111111]">
                      Próximos eventos
                    </h3>
                    <button
                      onClick={() => setActiveTab("events")}
                      className="text-[12px] text-[#8e8e93] hover:text-[#007aff] cursor-pointer"
                    >
                      Ver todos →
                    </button>
                  </div>

                  <div className="divide-y divide-[#f0f0f3]">
                    {/* Item 1: Casamento Marta & João */}
                    <div className="py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Event Photo with Day 03 Overlay */}
                        <div
                          className="w-[58px] h-[58px] rounded-[14px] flex-shrink-0 bg-cover bg-center relative overflow-hidden border border-black/5"
                          style={{
                            backgroundImage: `url("https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80")`,
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                          <span className="absolute left-2 bottom-1.5 text-white text-[13px] font-extrabold tracking-[-0.2px] drop-shadow-sm">
                            03
                          </span>
                        </div>

                        <div>
                          <div className="text-[14px] font-bold text-[#111111]">
                            Casamento Marta & João
                          </div>
                          <div className="text-[12px] text-[#8e8e93] mt-0.5">
                            Sáb · 3 Out · 14:00 · Quinta da Serra
                          </div>
                        </div>
                      </div>

                      <span className="px-3 py-1 rounded-full text-[12px] font-semibold bg-[#eaf8ee] text-[#24793a]">
                        Confirmado
                      </span>
                    </div>

                    {/* Item 2: Mastercard Gala */}
                    <div className="py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Event Photo with Day 06 Overlay */}
                        <div
                          className="w-[58px] h-[58px] rounded-[14px] flex-shrink-0 bg-cover bg-center relative overflow-hidden border border-black/5"
                          style={{
                            backgroundImage: `url("https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=600&q=80")`,
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                          <span className="absolute left-2 bottom-1.5 text-white text-[13px] font-extrabold tracking-[-0.2px] drop-shadow-sm">
                            06
                          </span>
                        </div>

                        <div>
                          <div className="text-[14px] font-bold text-[#111111]">Mastercard Gala</div>
                          <div className="text-[12px] text-[#8e8e93] mt-0.5">
                            Ter · 6 Out · 18:00 · Estufa Fria
                          </div>
                        </div>
                      </div>

                      <span className="px-3 py-1 rounded-full text-[12px] font-semibold bg-[#fff4df] text-[#9a5b00]">
                        Preparação
                      </span>
                    </div>

                    {/* Item 3: L'Oréal Brand Dinner */}
                    <div className="py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Event Photo with Day 09 Overlay */}
                        <div
                          className="w-[58px] h-[58px] rounded-[14px] flex-shrink-0 bg-cover bg-center relative overflow-hidden border border-black/5"
                          style={{
                            backgroundImage: `url("https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=600&q=80")`,
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                          <span className="absolute left-2 bottom-1.5 text-white text-[13px] font-extrabold tracking-[-0.2px] drop-shadow-sm">
                            09
                          </span>
                        </div>

                        <div>
                          <div className="text-[14px] font-bold text-[#111111]">
                            L'Oréal Brand Dinner
                          </div>
                          <div className="text-[12px] text-[#8e8e93] mt-0.5">
                            Sex · 9 Out · 19:30 · Lisboa
                          </div>
                        </div>
                      </div>

                      <span className="px-3 py-1 rounded-full text-[12px] font-semibold bg-[#f2f2f4] text-[#48484a]">
                        Planeamento
                      </span>
                    </div>
                  </div>
                </div>

                {/* CARD 2: Inventário */}
                <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[18px] font-bold tracking-[-0.35px] text-[#111111]">
                      Inventário
                    </h3>
                    <button
                      onClick={() => setActiveTab("inventory")}
                      className="text-[12px] text-[#8e8e93] hover:text-[#007aff] cursor-pointer"
                    >
                      Abrir inventário →
                    </button>
                  </div>

                  <div className="divide-y divide-[#f0f0f3]">
                    {/* Item 1 */}
                    <div className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-[42px] h-[42px] rounded-[10px] bg-[#f2f2f4] flex items-center justify-center text-[21px] flex-shrink-0">
                          🪑
                        </div>
                        <div>
                          <div className="text-[14px] font-bold text-[#111111]">
                            Cadeira Chiavari Dourada
                          </div>
                          <div className="text-[12px] text-[#8e8e93] mt-0.5">
                            42 disponíveis de 60
                          </div>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-[12px] font-semibold bg-[#eaf8ee] text-[#24793a]">
                        Disponível
                      </span>
                    </div>

                    {/* Item 2 */}
                    <div className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-[42px] h-[42px] rounded-[10px] bg-[#f2f2f4] flex items-center justify-center text-[21px] flex-shrink-0">
                          🕯️
                        </div>
                        <div>
                          <div className="text-[14px] font-bold text-[#111111]">Vela LED Âmbar</div>
                          <div className="text-[12px] text-[#8e8e93] mt-0.5">
                            8 disponíveis · mínimo 20
                          </div>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-[12px] font-semibold bg-[#fff4df] text-[#9a5b00]">
                        Baixo
                      </span>
                    </div>

                    {/* Item 3 */}
                    <div className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-[42px] h-[42px] rounded-[10px] bg-[#f2f2f4] flex items-center justify-center text-[21px] flex-shrink-0">
                          ◉
                        </div>
                        <div>
                          <div className="text-[14px] font-bold text-[#111111]">Mesa Redonda 180</div>
                          <div className="text-[12px] text-[#8e8e93] mt-0.5">
                            22 disponíveis de 30
                          </div>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-[12px] font-semibold bg-[#eaf8ee] text-[#24793a]">
                        Disponível
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT STACK (1/3 width = 5 cols) */}
              <div className="lg:col-span-5 space-y-3.5">
                {/* CARD 1: Mini Month Calendar */}
                <div className="bg-white border border-[#ececf0] rounded-[22px] p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[18px] font-bold tracking-[-0.35px] text-[#111111]">
                        Outubro
                      </div>
                      <div className="text-[12px] text-[#8e8e93]">2026</div>
                    </div>
                    <button
                      onClick={() => setActiveTab("calendar")}
                      className="text-[12px] text-[#8e8e93] hover:text-[#007aff] cursor-pointer"
                    >
                      Abrir →
                    </button>
                  </div>

                  {/* Day of Week Labels */}
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#8e8e93] font-medium mb-1">
                    <div>S</div>
                    <div>T</div>
                    <div>Q</div>
                    <div>Q</div>
                    <div>S</div>
                    <div>S</div>
                    <div>D</div>
                  </div>

                  {/* Calendar Grid matching prototype */}
                  <div className="grid grid-cols-7 gap-1 text-center text-[12px]">
                    {/* Blanks */}
                    <div></div>
                    <div></div>
                    <div></div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">1</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">2</div>
                    <div className="h-8 flex items-center justify-center rounded-[9px] bg-[#f0f0f2] text-[#3a3a3c] font-semibold">
                      3
                    </div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">4</div>

                    <div className="h-8 flex items-center justify-center text-[#454549]">5</div>
                    <div className="h-8 flex items-center justify-center rounded-[9px] bg-[#f0f0f2] text-[#3a3a3c] font-semibold">
                      6
                    </div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">7</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">8</div>
                    <div className="h-8 flex items-center justify-center rounded-[9px] bg-[#f0f0f2] text-[#3a3a3c] font-semibold">
                      9
                    </div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">10</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">11</div>

                    <div className="h-8 flex items-center justify-center text-[#454549]">12</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">13</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">14</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">15</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">16</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">17</div>
                    <div className="h-8 flex items-center justify-center rounded-[9px] bg-[#f0f0f2] text-[#3a3a3c] font-semibold">
                      18
                    </div>

                    <div className="h-8 flex items-center justify-center text-[#454549]">19</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">20</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">21</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">22</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">23</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">24</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">25</div>

                    <div className="h-8 flex items-center justify-center text-[#454549]">26</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">27</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">28</div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">29</div>
                    <div className="h-8 flex items-center justify-center rounded-[9px] bg-[#111] text-white font-bold">
                      30
                    </div>
                    <div className="h-8 flex items-center justify-center text-[#454549]">31</div>
                    <div></div>
                  </div>
                </div>

                {/* CARD 2: Alertas importantes */}
                <div className="pt-1">
                  <div className="flex items-center gap-2.5 mb-2.5 px-1">
                    <div className="w-[34px] h-[34px] rounded-[11px] bg-white text-[#ff3b30] border border-[#ff3b30]/15 flex items-center justify-center font-bold text-[16px] shadow-xs">
                      !
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-[#111111]">
                        Alertas importantes
                      </div>
                      <div className="text-[12px] text-[#8e8e93]">3 itens requerem atenção</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* Alert 1 */}
                    <div
                      onClick={() => setActiveTab("inventory")}
                      className="cursor-pointer bg-[#ff9f0a]/[0.115] border border-[#ff9f0a]/[0.17] text-[#845000] rounded-[15px] p-3.5 flex items-center gap-3 transition hover:opacity-90"
                    >
                      <div className="w-[9px] h-[9px] rounded-full bg-[#ff9f0a] flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-[#845000]">
                          Velas LED abaixo do mínimo
                        </div>
                        <div className="text-[11px] text-[#845000]/70 mt-0.5">
                          8 disponíveis · mínimo 20
                        </div>
                      </div>
                      <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-white/70 text-[#845000]">
                        Stock
                      </span>
                    </div>

                    {/* Alert 2 */}
                    <div
                      onClick={() => setActiveTab("inventory")}
                      className="cursor-pointer bg-[#ff3b30]/[0.09] border border-[#ff3b30]/[0.16] text-[#a62a24] rounded-[15px] p-3.5 flex items-center gap-3 transition hover:opacity-90"
                    >
                      <div className="w-[9px] h-[9px] rounded-full bg-[#ff3b30] flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-[#a62a24]">
                          3 cadeiras danificadas
                        </div>
                        <div className="text-[11px] text-[#a62a24]/70 mt-0.5">
                          Cadeira Chiavari Dourada
                        </div>
                      </div>
                      <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-white/70 text-[#a62a24]">
                        Dano
                      </span>
                    </div>

                    {/* Alert 3 */}
                    <div
                      onClick={() => setActiveTab("events")}
                      className="cursor-pointer bg-[#ff9f0a]/[0.115] border border-[#ff9f0a]/[0.17] text-[#845000] rounded-[15px] p-3.5 flex items-center gap-3 transition hover:opacity-90"
                    >
                      <div className="w-[9px] h-[9px] rounded-full bg-[#ff9f0a] flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-[#845000]">
                          Mastercard Gala em preparação
                        </div>
                        <div className="text-[11px] text-[#845000]/70 mt-0.5">
                          Material ainda não está 100% preparado
                        </div>
                      </div>
                      <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-white/70 text-[#845000]">
                        Evento
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB 2: CALENDAR */}
        {activeTab === "calendar" && (
          <section className="bg-white border border-[#ececf0] rounded-[22px] p-6 shadow-xs space-y-4">
            <h2 className="text-[20px] font-bold">Calendário de Eventos</h2>
            <div className="divide-y divide-[#ececf0]">
              {eventsList.map((e) => (
                <div key={e.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold">{e.name}</div>
                    <div className="text-xs text-[#8e8e93]">
                      {new Date(e.startDate).toLocaleString("pt-PT")} · {e.venue}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#eaf8ee] text-[#24793a]">
                    {e.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 3: EVENTS */}
        {activeTab === "events" && (
          <section className="bg-white border border-[#ececf0] rounded-[22px] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[20px] font-bold">Eventos & Produção</h2>
              <button
                onClick={() => setShowEventWizard(true)}
                className="px-4 py-2 rounded-[12px] bg-[#111] text-white text-xs font-semibold"
              >
                ＋ Novo evento
              </button>
            </div>
            <div className="divide-y divide-[#ececf0]">
              {eventsList.map((e) => (
                <div key={e.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold">{e.name}</div>
                    <div className="text-xs text-[#8e8e93]">
                      {new Date(e.startDate).toLocaleDateString("pt-PT")} · {e.venue}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#f2f2f4] text-[#48484a]">
                    {e.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 4: INVENTORY */}
        {activeTab === "inventory" && (
          <section className="bg-white border border-[#ececf0] rounded-[22px] p-6 shadow-xs space-y-4">
            <h2 className="text-[20px] font-bold">Catálogo de Stock</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {initialItems.map((item) => (
                <div key={item.id} className="p-4 rounded-xl border border-[#ececf0] bg-[#fafafa]">
                  <div className="font-bold text-sm">{item.name}</div>
                  <div className="text-xs text-[#8e8e93] mt-1">{item.warehouseLocation}</div>
                  <div className="text-xs font-semibold mt-2">
                    Stock: {item.totalQuantity} unidades
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 5: MORE (Quotes, Clients, Finance) */}
        {activeTab === "more" && (
          <section className="bg-white border border-[#ececf0] rounded-[22px] p-6 shadow-xs space-y-4">
            <h2 className="text-[20px] font-bold">Gestão & Definições</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setShowQuoteWizard(true)}
                className="cursor-pointer p-4 rounded-xl border border-[#ececf0] bg-[#f8f8fa] hover:bg-white transition"
              >
                <div className="font-bold text-sm">Orçamentos</div>
                <div className="text-xs text-[#8e8e93]">Criar, exportar e enviar propostas</div>
              </div>
              <div className="p-4 rounded-xl border border-[#ececf0] bg-[#f8f8fa]">
                <div className="font-bold text-sm">Clientes CRM</div>
                <div className="text-xs text-[#8e8e93]">Histórico e contactos comerciais</div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Floating Bottom Navigation Bar (Matching prototype) */}
      <aside className="fixed bottom-0 left-0 right-0 z-40 bg-[rgba(249,249,251,0.96)] backdrop-blur-[24px] border-t border-[#ececf0] py-2 flex items-center justify-center">
        <div className="w-full max-w-[650px] flex items-center justify-around h-[52px]">
          {/* 1. Início */}
          <button
            onClick={() => setActiveTab("home")}
            className="w-[44px] h-[44px] rounded-[13px] flex items-center justify-center transition"
            style={{
              backgroundColor: activeTab === "home" ? "rgba(0,122,255,0.11)" : "transparent",
              color: activeTab === "home" ? "#007aff" : "#8e8e93",
            }}
            title="Início"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3.25 10.6 12 3.45l8.75 7.15" />
              <path d="M5.35 9.25V20.2h13.3V9.25" />
              <path d="M9.25 20.2v-6.35h5.5v6.35" />
            </svg>
          </button>

          {/* 2. Calendário */}
          <button
            onClick={() => setActiveTab("calendar")}
            className="w-[44px] h-[44px] rounded-[13px] flex items-center justify-center transition"
            style={{
              backgroundColor: activeTab === "calendar" ? "rgba(0,122,255,0.11)" : "transparent",
              color: activeTab === "calendar" ? "#007aff" : "#8e8e93",
            }}
            title="Calendário"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3.25" y="4.75" width="17.5" height="16" rx="2.6" />
              <path d="M7.45 3.2v4M16.55 3.2v4M3.25 9.4h17.5" />
              <path d="M7.2 13.1h2.15M11 13.1h2.15M14.8 13.1h2.15M7.2 16.8h2.15M11 16.8h2.15" />
            </svg>
          </button>

          {/* 3. Eventos */}
          <button
            onClick={() => setActiveTab("events")}
            className="w-[44px] h-[44px] rounded-[13px] flex items-center justify-center transition"
            style={{
              backgroundColor: activeTab === "events" ? "rgba(0,122,255,0.11)" : "transparent",
              color: activeTab === "events" ? "#007aff" : "#8e8e93",
            }}
            title="Eventos"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3.25 7.15h17.5v3.05a2.35 2.35 0 0 0 0 4.7v3.95H3.25V14.9a2.35 2.35 0 0 0 0-4.7z" />
              <path d="M9.2 7.15v11.7" />
              <path d="M13.2 10.45v5.1M15.75 10.45v5.1" strokeDasharray="1.1 2.1" />
            </svg>
          </button>

          {/* 4. Stock */}
          <button
            onClick={() => setActiveTab("inventory")}
            className="w-[44px] h-[44px] rounded-[13px] flex items-center justify-center transition"
            style={{
              backgroundColor: activeTab === "inventory" ? "rgba(0,122,255,0.11)" : "transparent",
              color: activeTab === "inventory" ? "#007aff" : "#8e8e93",
            }}
            title="Stock"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3.5 7.1 12 2.95l8.5 4.15v9.8L12 21.05 3.5 16.9z" />
              <path d="M3.85 7.3 12 11.45l8.15-4.15M12 11.45v9.6" />
              <path d="m8.05 4.9 8.25 4.2" />
            </svg>
          </button>

          {/* 5. Mais */}
          <button
            onClick={() => setActiveTab("more")}
            className="w-[44px] h-[44px] rounded-[13px] flex items-center justify-center transition"
            style={{
              backgroundColor: activeTab === "more" ? "rgba(0,122,255,0.11)" : "transparent",
              color: activeTab === "more" ? "#007aff" : "#8e8e93",
            }}
            title="Mais"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3.6" y="3.6" width="6.6" height="6.6" rx="1.85" />
              <rect x="13.8" y="3.6" width="6.6" height="6.6" rx="1.85" />
              <rect x="3.6" y="13.8" width="6.6" height="6.6" rx="1.85" />
              <rect x="13.8" y="13.8" width="6.6" height="6.6" rx="1.85" />
            </svg>
          </button>
        </div>
      </aside>

      {/* EVENT WIZARD MODAL */}
      {showEventWizard && (
        <EventWizardModal
          clients={initialClients}
          onClose={() => setShowEventWizard(false)}
          onCreated={(newEvent) => {
            setEventsList((prev) => [newEvent, ...prev]);
            setShowEventWizard(false);
          }}
        />
      )}

      {/* QUOTE WIZARD MODAL */}
      {showQuoteWizard && (
        <QuoteWizardModal
          clients={initialClients}
          events={eventsList}
          inventory={initialItems}
          onClose={() => setShowQuoteWizard(false)}
          onCreated={(newQuote) => {
            setQuotesList((prev) => [newQuote, ...prev]);
            setShowQuoteWizard(false);
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// EVENT WIZARD MODAL COMPONENT
// -------------------------------------------------------------
function EventWizardModal({
  clients,
  onClose,
  onCreated,
}: {
  clients: any[];
  onClose: () => void;
  onCreated: (event: any) => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [venue, setVenue] = useState("");
  const [startDate, setStartDate] = useState("2026-10-15T18:00");
  const [endDate, setEndDate] = useState("2026-10-15T23:59");
  const [prepDate, setPrepDate] = useState("2026-10-14T09:00");
  const [returnDate, setReturnDate] = useState("2026-10-16T12:00");
  const [status, setStatus] = useState("planeamento");
  const [totalBudget, setTotalBudget] = useState("3500");
  const [notes, setNotes] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState(
    "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=600&q=80"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("clientId", clientId);
      formData.set("venue", venue);
      formData.set("startDate", startDate);
      formData.set("endDate", endDate);
      formData.set("prepDate", prepDate);
      formData.set("returnDate", returnDate);
      formData.set("status", status);
      formData.set("totalBudget", totalBudget);
      formData.set("notes", notes);
      formData.set("coverImageUrl", coverImageUrl);

      const res = await createEventAction(formData);

      onCreated({
        id: res.id,
        name,
        clientId,
        venue,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        prepDate: new Date(prepDate),
        returnDate: new Date(returnDate),
        status,
        totalBudget: parseFloat(totalBudget || "0"),
        notes,
        coverImageUrl,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[22px] w-full max-w-lg border border-[#ececf0] shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-[#ececf0] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#007aff] uppercase tracking-wider">
              Passo {step} de 3
            </div>
            <h2 className="text-[17px] font-bold text-[#111111]">Novo Evento</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Nome do Evento *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Gala de Natal Santander"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Cliente Associado</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.contactName || "Sem contacto"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Localização / Venue</label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Ex: Pavilhão Carlos Lopes, Lisboa"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">Início do Evento *</label>
                  <input
                    type="datetime-local"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#3a3a3c] mb-1">Fim do Evento</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#f8f8fa] border border-[#ececf0] rounded-[14px] space-y-3">
                <div className="font-bold text-[11px] text-[#007aff] uppercase tracking-wider">
                  Datas Logísticas de Armazém
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-[#555] mb-1">Carga / Montagem</label>
                    <input
                      type="datetime-local"
                      value={prepDate}
                      onChange={(e) => setPrepDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#ececf0] rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-[#555] mb-1">Devolução Armazém</label>
                    <input
                      type="datetime-local"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#ececf0] rounded-lg focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Estado Inicial</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                >
                  <option value="planeamento">Planeamento</option>
                  <option value="orcamento">Orçamento</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="preparacao">Preparação</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Orçamento Estimado (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Notas Operacionais</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Necessária equipa de 4 montadores e carrinha extra."
                  className="w-full px-3 py-2 text-xs bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-[#ececf0] flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-[12px] bg-white border border-[#ececf0] text-xs font-bold hover:bg-[#f2f2f5]"
              >
                Voltar
              </button>
            ) : (
              <div></div>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="px-4 py-2 rounded-[12px] bg-[#111] text-white text-xs font-bold hover:bg-black"
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold shadow-xs transition"
              >
                {isSubmitting ? "A criar evento..." : "Criar Evento"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// NOVO ORÇAMENTO WIZARD MODAL COMPONENT
// -------------------------------------------------------------
function QuoteWizardModal({
  clients,
  events,
  inventory,
  onClose,
  onCreated,
}: {
  clients: any[];
  events: any[];
  inventory: any[];
  onClose: () => void;
  onCreated: (quote: any) => void;
}) {
  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [eventId, setEventId] = useState(events[0]?.id || "");
  const [validityDays, setValidityDays] = useState("15");

  const [lines, setLines] = useState<
    Array<{ itemId?: string; description: string; quantity: number; unitPrice: number }>
  >([
    {
      itemId: inventory[0]?.id,
      description: inventory[0]?.name || "Cadeira Chiavari Dourada",
      quantity: 50,
      unitPrice: inventory[0]?.unitPrice || 6.0,
    },
    {
      description: "Produção e montagem técnica",
      quantity: 1,
      unitPrice: 850.0,
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        itemId: inventory[0]?.id,
        description: inventory[0]?.name || "Artigo",
        quantity: 10,
        unitPrice: inventory[0]?.unitPrice || 5.0,
      },
    ]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, key: string, value: any) => {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [key]: value } : l))
    );
  };

  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const vatAmount = subtotal * 0.23;
  const total = subtotal + vatAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const quoteNumber = `ORC-2026-${Math.floor(100 + Math.random() * 900)}`;
      const formData = new FormData();
      formData.set("quoteNumber", quoteNumber);
      formData.set("clientId", clientId);
      formData.set("eventId", eventId);
      formData.set("validityDays", validityDays);
      formData.set("lines", JSON.stringify(lines));

      const res = await createQuoteAction(formData);

      onCreated({
        id: res.id,
        quoteNumber,
        clientId,
        eventId,
        accessToken: res.accessToken,
        status: "enviado",
        subtotal,
        vatAmount,
        total,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[22px] w-full max-w-xl border border-[#ececf0] shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-[#ececf0] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#007aff] uppercase tracking-wider">
              Passo {step} de 3
            </div>
            <h2 className="text-[17px] font-bold text-[#111111]">Novo Orçamento</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#f2f2f5] flex items-center justify-center text-[#8e8e93]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Cliente</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">Evento Associado</label>
                <select
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                >
                  {events.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      {evt.name} ({new Date(evt.startDate).toLocaleDateString("pt-PT")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#3a3a3c] mb-1">
                  Validade da Proposta (Dias)
                </label>
                <input
                  type="number"
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#111111]">
                  Linhas de Artigos & Serviços
                </span>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-xs font-bold text-[#007aff] hover:underline"
                >
                  + Adicionar linha
                </button>
              </div>

              <div className="space-y-2.5 max-h-60 overflow-y-auto">
                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#f8f8fa] border border-[#ececf0] rounded-xl grid grid-cols-12 gap-2 items-center"
                  >
                    <div className="col-span-6">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => updateLine(idx, "description", e.target.value)}
                        placeholder="Descrição"
                        className="w-full px-2 py-1 bg-white border border-[#ececf0] rounded-lg text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(idx, "quantity", parseInt(e.target.value || "1", 10))
                        }
                        className="w-full px-2 py-1 bg-white border border-[#ececf0] rounded-lg text-xs text-center"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) =>
                          updateLine(idx, "unitPrice", parseFloat(e.target.value || "0"))
                        }
                        className="w-full px-2 py-1 bg-white border border-[#ececf0] rounded-lg text-xs text-right"
                      />
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-[#8e8e93] hover:text-rose-600"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-[#f8f8fa] border border-[#ececf0] rounded-xl space-y-2">
                <div className="flex justify-between text-xs text-[#8e8e93]">
                  <span>Subtotal</span>
                  <span>€{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#8e8e93]">
                  <span>IVA (23%)</span>
                  <span>€{vatAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#ececf0] text-[#111111]">
                  <span>Total da Proposta</span>
                  <span className="text-[#111111]">€{total.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-[11px] text-[#8e8e93]">
                Ao gerar este orçamento, será criado um link de aprovação direta para o cliente
                com assinatura digital.
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-[#ececf0] flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-[12px] bg-white border border-[#ececf0] text-xs font-bold hover:bg-[#f2f2f5]"
              >
                Voltar
              </button>
            ) : (
              <div></div>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="px-4 py-2 rounded-[12px] bg-[#111] text-white text-xs font-bold hover:bg-black"
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-[12px] bg-[#111] hover:bg-black text-white text-xs font-bold shadow-xs transition"
              >
                {isSubmitting ? "A gerar orçamento..." : "Gerar Orçamento & Link"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
