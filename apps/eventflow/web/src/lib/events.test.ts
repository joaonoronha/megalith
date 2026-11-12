import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isMeetingEvent, canEventReceiveQuote, isCancelledEvent, countsForFinance } from "./events.js";

describe("CFM Events: Meeting and Quota Business Rules", () => {
  test("identifies Calendly meetings by URI", () => {
    const meeting = {
      id: "evt-123",
      name: "João Silva · Briefing",
      category: "Reunião Calendly",
      calendlyEventUri: "https://api.calendly.com/scheduled_events/abc-123",
    };

    assert.equal(isMeetingEvent(meeting), true);
    assert.equal(canEventReceiveQuote(meeting), false, "Meetings must NOT receive quotas");
  });

  test("identifies meetings by category 'Reunião Calendly' or 'Consulta / Briefing'", () => {
    const meeting1 = {
      name: "Reunião Inicial de Alinhamento",
      category: "Reunião Calendly",
    };
    const meeting2 = {
      name: "Consulta de Decoração",
      category: "Consulta / Briefing",
    };

    assert.equal(isMeetingEvent(meeting1), true);
    assert.equal(canEventReceiveQuote(meeting1), false);
    assert.equal(isMeetingEvent(meeting2), true);
    assert.equal(canEventReceiveQuote(meeting2), false);
  });

  test("identifies meetings by name prefix or briefing theme", () => {
    const meetingName = {
      name: "Reunião: Madalena Rosa",
      category: "Geral",
    };
    const meetingTheme = {
      name: "Sessão Online",
      theme: "Briefing & Consulta de Evento",
    };

    assert.equal(isMeetingEvent(meetingName), true);
    assert.equal(canEventReceiveQuote(meetingName), false);
    assert.equal(isMeetingEvent(meetingTheme), true);
    assert.equal(canEventReceiveQuote(meetingTheme), false);
  });

  test("allows actual production events to receive quotas", () => {
    const galaEvent = {
      id: "evt-gala",
      name: "Mastercard Gala 2026",
      category: "Gala Corporativa",
      theme: "Black & Gold Elegance",
      calendlyEventUri: null,
    };
    const weddingEvent = {
      id: "evt-wedding",
      name: "Casamento Sofia & Diogo",
      category: "Casamento",
      theme: "Boho Chic Terracotta",
      calendlyEventUri: null,
    };

    assert.equal(isMeetingEvent(galaEvent), false);
    assert.equal(canEventReceiveQuote(galaEvent), true, "Production events CAN receive quotas");

    assert.equal(isMeetingEvent(weddingEvent), false);
    assert.equal(canEventReceiveQuote(weddingEvent), true, "Production events CAN receive quotas");
  });

  test("handles null or undefined safely", () => {
    assert.equal(isMeetingEvent(null), false);
    assert.equal(canEventReceiveQuote(null), false);
    assert.equal(isMeetingEvent(undefined), false);
    assert.equal(canEventReceiveQuote(undefined), false);
  });

  test("event configuration supports Google Meet and in-person meetings with the client", () => {
    const googleMeet = {
      id: "mtg-001",
      eventId: "evt-wedding",
      clientId: "cli-marta",
      title: "Alinhamento de Proposta & Cronograma",
      type: "google_meet",
      meetUrl: "https://meet.google.com/cfm-wedding-briefing",
      location: null,
      status: "agendada",
      startDate: new Date("2026-11-20T14:00:00Z"),
    };

    const inPersonMeet = {
      id: "mtg-002",
      eventId: "evt-wedding",
      clientId: "cli-marta",
      title: "Visita Técnica e Prova de Flores",
      type: "presencial",
      meetUrl: null,
      location: "Quinta da Regaleira, Sintra",
      status: "agendada",
      startDate: new Date("2026-11-25T10:30:00Z"),
    };

    assert.equal(googleMeet.type, "google_meet");
    assert.match(googleMeet.meetUrl, /^https:\/\/meet\.google\.com\//);
    assert.equal(googleMeet.eventId, "evt-wedding");

    assert.equal(inPersonMeet.type, "presencial");
    assert.equal(inPersonMeet.meetUrl, null);
    assert.ok(inPersonMeet.location && inPersonMeet.location.length > 0);
    assert.equal(inPersonMeet.eventId, "evt-wedding");
  });

  test("cancelled events do not count for the finance part", () => {
    const activeConfirmed = {
      id: "evt-001",
      name: "Casamento Filipa & Rui",
      status: "confirmado",
      customerPrice: 8500,
      totalBudget: 4200,
    };

    const inPrep = {
      id: "evt-002",
      name: "Festa Corporativa Galp",
      status: "preparacao",
      customerPrice: 6200,
      totalBudget: 3100,
    };

    const cancelledEvent = {
      id: "evt-003",
      name: "Jantar de Gala Cancelado",
      status: "cancelado",
      customerPrice: 15000,
      totalBudget: 8000,
    };

    const cancelledFem = {
      id: "evt-004",
      name: "Sessão Fotográfica Cancelada",
      status: "cancelada",
      customerPrice: 3000,
      totalBudget: 1200,
    };

    const calendlyMeeting = {
      id: "evt-005",
      name: "Reunião Calendly: Miguel",
      status: "confirmado",
      category: "Reunião Calendly",
      customerPrice: 0,
      totalBudget: 0,
    };

    // 1. isCancelledEvent verification
    assert.equal(isCancelledEvent(cancelledEvent), true);
    assert.equal(isCancelledEvent(cancelledFem), true);
    assert.equal(isCancelledEvent(activeConfirmed), false);
    assert.equal(isCancelledEvent(inPrep), false);
    assert.equal(isCancelledEvent(null), false);

    // 2. countsForFinance eligibility
    assert.equal(countsForFinance(activeConfirmed), true);
    assert.equal(countsForFinance(inPrep), true);
    assert.equal(countsForFinance(cancelledEvent), false, "Cancelled events must NOT count for finance");
    assert.equal(countsForFinance(cancelledFem), false, "Cancelled events must NOT count for finance");
    assert.equal(countsForFinance(calendlyMeeting), false, "Calendly meetings must NOT count for finance");

    // 3. Financial calculations simulation
    const allEvents = [activeConfirmed, inPrep, cancelledEvent, cancelledFem, calendlyMeeting];
    const eligibleEvents = allEvents.filter((e) => countsForFinance(e));

    const totalFaturacaoProjetada = eligibleEvents.reduce((acc, e) => acc + (e.customerPrice || 0), 0);
    const totalCustosProjetados = eligibleEvents.reduce((acc, e) => acc + (e.totalBudget || 0), 0);
    const totalLucroProjetado = totalFaturacaoProjetada - totalCustosProjetados;

    // Should only count activeConfirmed (8500, 4200) + inPrep (6200, 3100) = 14700 billing, 7300 budget, 7400 profit
    assert.equal(eligibleEvents.length, 2);
    assert.equal(totalFaturacaoProjetada, 14700);
    assert.equal(totalCustosProjetados, 7300);
    assert.equal(totalLucroProjetado, 7400);
  });
});

