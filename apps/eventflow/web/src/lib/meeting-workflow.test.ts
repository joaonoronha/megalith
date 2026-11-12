import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isMeetingEvent, canEventReceiveQuote } from "./events.js";

describe("CFM Events: Meeting Workflow & Conceptual Separation", () => {
  test("meetings differ conceptually from production events (summary, action items, participants, schedule)", () => {
    const meeting = {
      id: "meet-101",
      name: "Reunião de Alinhamento: Joana & Vasco",
      category: "Reunião Calendly",
      startDate: new Date("2026-11-20T10:00:00Z"),
      endDate: new Date("2026-11-20T11:00:00Z"),
      venue: "https://meet.google.com/cfm-meet-xyz",
      meetingSummary: "Discutida a paleta de cores botânica e cronograma de montagem.",
      meetingParticipants: JSON.stringify([
        { name: "João Noronha", role: "Diretor Criativo", type: "team" },
        { name: "Joana Silva", role: "Noiva / Cliente", type: "client" },
      ]),
      linkedEventId: null,
    };

    assert.equal(isMeetingEvent(meeting), true);
    assert.equal(canEventReceiveQuote(meeting), false);

    // Parse participants and verify participant structure
    const participants = JSON.parse(meeting.meetingParticipants);
    assert.equal(participants.length, 2);
    assert.equal(participants[0].name, "João Noronha");
    assert.equal(participants[0].type, "team");
    assert.equal(participants[1].name, "Joana Silva");
    assert.equal(participants[1].type, "client");

    // Verify time schedule calculation
    const durationMinutes =
      (meeting.endDate.getTime() - meeting.startDate.getTime()) / (1000 * 60);
    assert.equal(durationMinutes, 60);
  });

  test("associating an unlinked meeting to a production event", () => {
    const meeting = {
      id: "meet-102",
      name: "Consulta Inicial: Casamento Joana",
      category: "Consulta / Briefing",
      linkedEventId: null,
    };

    const productionEvent = {
      id: "prod-201",
      name: "Casamento Joana & Vasco na Quinta da Regaleira",
      category: "Casamento",
      linkedEventId: null,
    };

    assert.equal(meeting.linkedEventId, null);

    // Business operation: Link meeting to event
    function linkMeetingToEvent(targetMeeting: typeof meeting, eventId: string) {
      if (!isMeetingEvent(targetMeeting)) {
        throw new Error("Apenas reuniões podem ser vinculadas a um evento de produção.");
      }
      return {
        ...targetMeeting,
        linkedEventId: eventId,
      };
    }

    const linked = linkMeetingToEvent(meeting, productionEvent.id);
    assert.equal(linked.linkedEventId, "prod-201");

    // Business operation: Unlink meeting
    function unlinkMeetingFromEvent(targetMeeting: typeof linked) {
      return {
        ...targetMeeting,
        linkedEventId: null,
      };
    }

    const unlinked = unlinkMeetingFromEvent(linked);
    assert.equal(unlinked.linkedEventId, null);
  });

  test("action items for meetings track completion and assignees", () => {
    const meetingActionItems = [
      {
        id: "task-1",
        eventId: "meet-101",
        title: "Enviar catálogo de iluminação suspensa",
        completed: false,
        priority: "alta",
        assignedTo: "user-1",
      },
      {
        id: "task-2",
        eventId: "meet-101",
        title: "Confirmar medições da pérgola com o espaço",
        completed: true,
        priority: "normal",
        assignedTo: "user-2",
      },
    ];

    const pending = meetingActionItems.filter((t) => !t.completed);
    const completed = meetingActionItems.filter((t) => t.completed);

    assert.equal(pending.length, 1);
    assert.equal(pending[0].title, "Enviar catálogo de iluminação suspensa");
    assert.equal(completed.length, 1);
    assert.equal(completed[0].completed, true);
  });
});
