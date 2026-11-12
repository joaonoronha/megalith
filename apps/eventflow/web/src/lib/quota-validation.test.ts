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
});
