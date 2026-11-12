import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isMeetingEvent, canEventReceiveQuote } from "./events.js";

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
});

