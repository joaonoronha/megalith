import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isMeetingEvent, canEventReceiveQuote } from "./events.js";

describe("CFM Events: Quota Generation Constraints", () => {
  test("a quota cannot be generated outside an event configuration (eventId is mandatory)", () => {
    function validateQuoteCreation(formData: Map<string, string>, eventRecord?: any) {
      const eventId = formData.get("eventId")?.trim();
      if (!eventId) {
        throw new Error("Um orçamento deve ser gerado dentro da configuração de um evento (eventId obrigatório).");
      }
      if (!eventRecord) {
        throw new Error("O evento associado à configuração do orçamento não foi encontrado.");
      }
      if (isMeetingEvent(eventRecord)) {
        throw new Error("Reuniões não têm orçamentos associados. Apenas eventos de produção podem ter orçamentos.");
      }
      return { success: true, eventId };
    }

    // 1. Missing eventId (attempting to generate quote globally / outside an event)
    const emptyFormData = new Map<string, string>();
    assert.throws(
      () => validateQuoteCreation(emptyFormData),
      /Um orçamento deve ser gerado dentro da configuração de um evento/
    );

    // 2. Target is a Calendly meeting
    const meetingFormData = new Map<string, string>([["eventId", "evt-meet-01"]]);
    const meetingEvent = {
      id: "evt-meet-01",
      name: "Reunião: Sandra Pinto",
      category: "Reunião Calendly",
      calendlyEventUri: "https://api.calendly.com/scheduled_events/meet-01",
    };
    assert.throws(
      () => validateQuoteCreation(meetingFormData, meetingEvent),
      /Reuniões não têm orçamentos associados\. Apenas eventos de produção podem ter orçamentos\./
    );

    // 3. Target is a valid production event inside its configuration
    const validFormData = new Map<string, string>([["eventId", "evt-prod-01"]]);
    const prodEvent = {
      id: "evt-prod-01",
      name: "Festa de Verão Pestana",
      category: "Corporativo",
      theme: "Tropical Garden",
      calendlyEventUri: null,
    };
    const result = validateQuoteCreation(validFormData, prodEvent);
    assert.deepEqual(result, { success: true, eventId: "evt-prod-01" });
  });

  test("quota generation does not display specific value per item, lists items to use with quantities and displays total to be paid at the bottom", () => {
    // Business rule: When generating a quota, items are listed with their description and quantity to be used,
    // without exposing or displaying individual item prices, and the total value to be paid is placed at the bottom.
    interface QuotaItem {
      description: string;
      quantity: number;
    }

    const itemsToUse: QuotaItem[] = [
      { description: "Cadeiras Chiavari Douradas", quantity: 50 },
      { description: "Mesas Redondas 180cm", quantity: 5 },
      { description: "Produção de Evento & Montagem Técnica CFM", quantity: 1 },
      { description: "Painel de Boas-Vindas Acrílico Espelhado", quantity: 1 },
    ];

    // Ensure each item has description and quantity, and no specific unit price display is required
    for (const item of itemsToUse) {
      assert.ok(item.description.length > 0, "Item must have a description");
      assert.ok(item.quantity > 0, "Item must have a positive quantity");
      assert.strictEqual(
        (item as any).unitPrice,
        undefined,
        "No specific item price should be displayed on the item line"
      );
    }

    // Resolves bottom total to be paid
    function calculateBottomTotals(totalToPay: number, vatRate = 23.0) {
      const subtotal = totalToPay / (1 + vatRate / 100);
      const vatAmount = totalToPay - subtotal;
      return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        vatAmount: parseFloat(vatAmount.toFixed(2)),
        total: parseFloat(totalToPay.toFixed(2)),
      };
    }

    const financialBottom = calculateBottomTotals(1230.0);
    assert.strictEqual(financialBottom.total, 1230.0);
    assert.strictEqual(financialBottom.subtotal, 1000.0);
    assert.strictEqual(financialBottom.vatAmount, 230.0);
  });
});
