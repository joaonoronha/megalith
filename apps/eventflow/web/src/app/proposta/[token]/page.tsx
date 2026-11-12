import { db } from "@/db/client";
import { quotes, quoteLines, clients, events, quoteTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

import PrintButton from "@/components/PrintButton";

async function approveQuoteAction(formData: FormData) {
  "use server";
  const token = formData.get("token") as string;
  const signatoryName = formData.get("signatoryName") as string;

  if (!token) return;

  const quote = await db.query.quotes.findFirst({
    where: eq(quotes.accessToken, token),
  });

  if (!quote || quote.status === "aprovado") return;

  // 1. Mark quote as approved
  await db
    .update(quotes)
    .set({
      status: "aprovado",
      signedAt: new Date(),
      signatureData: `Assinado digitalmente por ${signatoryName || "Cliente"}`,
    })
    .where(eq(quotes.id, quote.id));

  // 2. Lock event status to "confirmado"
  if (quote.eventId) {
    await db
      .update(events)
      .set({ status: "confirmado" })
      .where(eq(events.id, quote.eventId));
  }

  revalidatePath(`/proposta/${token}`);
}

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const quote = await db.query.quotes.findFirst({
    where: eq(quotes.accessToken, token),
  });

  if (!quote) {
    notFound();
  }

  const client = quote.clientId
    ? await db.query.clients.findFirst({ where: eq(clients.id, quote.clientId) })
    : null;

  const event = quote.eventId
    ? await db.query.events.findFirst({ where: eq(events.id, quote.eventId) })
    : null;

  const lines = await db.query.quoteLines.findMany({
    where: eq(quoteLines.quoteId, quote.id),
  });

  const template = (await db.query.quoteTemplates.findFirst()) || {
    companyName: "CFM EVENTOS",
    tagline: "Produção & Decoração de Eventos",
    contactInfo: "geral@cfmeventos.pt · +351 912 345 678",
    paymentTerms: "50% adjudicação · 50% na desmontagem",
    footerNotes: "Obrigado pela preferência e confiança na CFM Eventos.",
    brandColor: "#111111",
  };

  const isApproved = quote.status === "aprovado";

  const formattedDate = new Intl.DateTimeFormat("pt-PT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(quote.createdAt);

  const eventDateFormatted = event?.startDate
    ? new Intl.DateTimeFormat("pt-PT", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(event.startDate))
    : "A definir";

  return (
    <div className="min-h-screen bg-[#f3f3f5] py-10 px-4 flex flex-col items-center print:bg-white print:py-0 print:px-0">
      {/* Top Banner */}
      <div className="w-full max-w-3xl mb-4 flex items-center justify-between text-xs text-[#8e8e93] print:hidden">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#007aff]"></span>
          <span>CFM Eventos Portal do Cliente</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Validade: {quote.validityDays} dias</span>
          <PrintButton />
        </div>
      </div>

      {/* Main Quote Paper */}
      <div className="w-full max-w-3xl bg-white border border-[#ececf0] rounded-2xl p-8 sm:p-12 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between border-b border-[#ececf0] pb-8 gap-6">
          <div>
            <div className="text-2xl font-black tracking-tight text-[#111111]">
              {template.companyName}
            </div>
            <div className="text-xs text-[#8e8e93] mt-0.5">{template.tagline}</div>
            <div className="text-xs text-[#8e8e93] mt-1">{template.contactInfo}</div>
          </div>
          <div className="sm:text-right">
            <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#f2f2f5] text-[#3a3a3c] mb-1">
              Orçamento Comercial
            </span>
            <h1 className="text-xl font-bold tracking-tight text-[#111111]">{quote.quoteNumber}</h1>
            <div className="text-xs text-[#8e8e93]">{formattedDate}</div>
          </div>
        </div>

        {/* Client & Event Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-[#ececf0] text-sm">
          <div>
            <div className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider mb-1">
              Cliente
            </div>
            <div className="font-semibold text-[#111111]">{client?.name || "Cliente CFM"}</div>
            {client?.contactName && (
              <div className="text-xs text-[#8e8e93]">A/C {client.contactName}</div>
            )}
            {client?.email && <div className="text-xs text-[#8e8e93]">{client.email}</div>}
            {client?.nif && <div className="text-xs text-[#8e8e93]">NIF: {client.nif}</div>}
          </div>
          <div className="sm:text-right">
            <div className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider mb-1">
              Evento
            </div>
            <div className="font-semibold text-[#111111]">{event?.name || "Evento"}</div>
            <div className="text-xs text-[#8e8e93]">{eventDateFormatted}</div>
            {event?.venue && <div className="text-xs text-[#8e8e93]">{event.venue}</div>}
          </div>
        </div>

        {/* Line Items */}
        <div className="py-6">
          <div className="grid grid-cols-12 text-xs font-semibold text-[#8e8e93] uppercase tracking-wider pb-3 border-b border-[#ececf0]">
            <div className="col-span-6">Descrição</div>
            <div className="col-span-2 text-center">Qtd.</div>
            <div className="col-span-2 text-right">Unitário</div>
            <div className="col-span-2 text-right">Total</div>
          </div>

          <div className="divide-y divide-[#ececf0]">
            {lines.map((item) => (
              <div key={item.id} className="grid grid-cols-12 py-3.5 text-sm items-center">
                <div className="col-span-6 font-medium text-[#111111]">{item.description}</div>
                <div className="col-span-2 text-center text-[#8e8e93]">{item.quantity}</div>
                <div className="col-span-2 text-right text-[#8e8e93]">
                  €{item.unitPrice.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
                </div>
                <div className="col-span-2 text-right font-medium text-[#111111]">
                  €{item.total.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="pt-4 border-t border-[#ececf0] flex flex-col items-end gap-1.5 text-sm">
          <div className="flex justify-between w-64 text-[#8e8e93]">
            <span>Subtotal</span>
            <span>€{quote.subtotal.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between w-64 text-[#8e8e93]">
            <span>IVA ({quote.vatRate}%)</span>
            <span>€{quote.vatAmount.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center w-64 pt-3 mt-2 border-t border-[#ececf0]">
            <span className="font-bold text-[#111111] text-base">Total</span>
            <span
              className="px-3 py-1.5 rounded-lg text-white font-bold text-lg"
              style={{ backgroundColor: template.brandColor }}
            >
              €{quote.total.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Terms & Footer */}
        <div className="mt-10 pt-6 border-t border-[#ececf0] text-xs text-[#8e8e93] space-y-1">
          <div>
            <strong className="text-[#111111]">Condições de pagamento:</strong>{" "}
            {template.paymentTerms}
          </div>
          <div>{template.footerNotes}</div>
        </div>

        {/* Approval Area */}
        <div className="mt-8 pt-6 border-t border-[#ececf0]">
          {isApproved ? (
            <div className="bg-[#eaf8ee] border border-[#34c759]/20 rounded-xl p-5 text-center text-[#24793a]">
              <div className="text-xl font-bold mb-1">✓ Orçamento Aprovado</div>
              <div className="text-xs">
                {quote.signatureData} em{" "}
                {quote.signedAt
                  ? new Intl.DateTimeFormat("pt-PT", { dateStyle: "long", timeStyle: "short" }).format(
                      new Date(quote.signedAt)
                    )
                  : "Data confirmada"}
              </div>
              <div className="text-xs text-[#24793a]/80 mt-1">
                A equipa da CFM Eventos iniciou os preparativos operacionais.
              </div>
            </div>
          ) : (
            <form action={approveQuoteAction} className="bg-[#fafafa] border border-[#ececf0] rounded-xl p-6 print:hidden">
              <input type="hidden" name="token" value={token} />
              <div className="mb-4">
                <h3 className="text-base font-bold text-[#111111]">Aprovar e Adjudicar Proposta</h3>
                <p className="text-xs text-[#8e8e93] mt-1">
                  Ao aprovar esta proposta comercial, confirma a adjudicação dos serviços e reserva de materiais nas datas acordadas.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-[#3a3a3c] mb-1">
                    Nome do Responsável
                  </label>
                  <input
                    type="text"
                    name="signatoryName"
                    required
                    defaultValue={client?.contactName || ""}
                    placeholder="Ex: João Silva"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#ececf0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-lg bg-[#007aff] hover:bg-[#0062cc] text-white font-semibold text-sm transition shadow-sm"
                  >
                    Confirmar & Aprovar Orçamento
                  </button>
                </div>
              </div>
              <div className="text-[11px] text-[#8e8e93]">
                Será enviado comprovativo digital e o evento passará automaticamente para o estado <strong>Confirmado</strong>.
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
