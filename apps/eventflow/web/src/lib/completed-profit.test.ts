import { describe, it } from "node:test";
import assert from "node:assert";
import { computeCompletedEventsProfit } from "./profit-trajectory";

describe("CFM Events: Overview Resumo Financeiro & Profit Trajectory", () => {
  it("only calculates profits from completed events and excludes meetings and cancelled events", () => {
    const mockEvents = [
      {
        id: "evt-1",
        name: "Concluido Event 1",
        status: "concluido",
        startDate: "2026-08-10T10:00:00Z",
        customerPrice: 5000,
        totalBudget: 3000,
      },
      {
        id: "evt-2",
        name: "Concluido Event 2",
        status: "concluido",
        startDate: "2026-08-20T10:00:00Z",
        customerPrice: 8000,
        totalBudget: 4000,
      },
      {
        id: "evt-3",
        name: "Confirmado Event (Upcoming)",
        status: "confirmado",
        startDate: "2026-11-20T10:00:00Z",
        customerPrice: 10000,
        totalBudget: 5000,
      },
      {
        id: "evt-4",
        name: "Cancelado Event",
        status: "cancelado",
        startDate: "2026-08-15T10:00:00Z",
        customerPrice: 6000,
        totalBudget: 3000,
      },
      {
        id: "evt-5",
        name: "Reunião Calendly Briefing",
        status: "concluido",
        category: "Reunião Calendly",
        startDate: "2026-08-18T10:00:00Z",
        customerPrice: 500,
        totalBudget: 0,
      },
    ];

    const result = computeCompletedEventsProfit(mockEvents, []);

    assert.strictEqual(result.events.length, 2);
    assert.strictEqual(result.events[0].id, "evt-1");
    assert.strictEqual(result.events[0].profit, 2000); // 5000 - 3000
    assert.strictEqual(result.events[1].id, "evt-2");
    assert.strictEqual(result.events[1].profit, 4000); // 8000 - 4000
    assert.strictEqual(result.totalProfit, 6000); // 2000 + 4000
  });

  it("sums profits per month to build company trajectory", () => {
    const mockEvents = [
      {
        id: "evt-aug-1",
        name: "Sunset August",
        status: "concluido",
        startDate: "2026-08-14T10:00:00Z",
        customerPrice: 5200,
        totalBudget: 2800, // profit: 2400
      },
      {
        id: "evt-aug-2",
        name: "Wedding August",
        status: "concluido",
        startDate: "2026-08-22T10:00:00Z",
        customerPrice: 9400,
        totalBudget: 5100, // profit: 4300
      },
      {
        id: "evt-sep-1",
        name: "Tech Summit September",
        status: "concluido",
        startDate: "2026-09-11T10:00:00Z",
        customerPrice: 6800,
        totalBudget: 3500, // profit: 3300
      },
    ];

    const result = computeCompletedEventsProfit(mockEvents, []);

    assert.strictEqual(result.monthlyTrajectory.length, 2);
    assert.strictEqual(result.monthlyTrajectory[0].monthKey, "2026-08");
    assert.strictEqual(result.monthlyTrajectory[0].monthlyProfit, 6700); // 2400 + 4300
    assert.strictEqual(result.monthlyTrajectory[0].events.length, 2);

    assert.strictEqual(result.monthlyTrajectory[1].monthKey, "2026-09");
    assert.strictEqual(result.monthlyTrajectory[1].monthlyProfit, 3300);
    assert.strictEqual(result.monthlyTrajectory[1].events.length, 1);

    assert.strictEqual(result.totalProfit, 10000);
  });

  it("handles real financial movements when present", () => {
    const mockEvents = [
      {
        id: "evt-1",
        name: "Gala Event",
        status: "concluido",
        startDate: "2026-10-10T10:00:00Z",
        customerPrice: 10000,
        totalBudget: 6000,
      },
    ];

    const mockMovements = [
      { eventId: "evt-1", type: "entrada", amount: 10500 },
      { eventId: "evt-1", type: "saida", amount: 5500 },
    ];

    const result = computeCompletedEventsProfit(mockEvents, mockMovements);

    assert.strictEqual(result.events[0].revenue, 10500);
    assert.strictEqual(result.events[0].costs, 5500);
    assert.strictEqual(result.events[0].profit, 5000);
    assert.strictEqual(result.totalProfit, 5000);
  });

  it("does not let partial deposits suppress full contracted revenue on completed events", () => {
    const mockEvents = [
      {
        id: "evt-partial",
        name: "Partial Paid Event",
        status: "concluido",
        startDate: "2026-10-15T10:00:00Z",
        customerPrice: 8000,
        totalBudget: 3000,
      },
    ];

    // Client only paid 1000€ deposit so far, 7000€ still pending invoice
    const mockMovements = [
      { eventId: "evt-partial", type: "entrada", amount: 1000 },
      { eventId: "evt-partial", type: "saida", amount: 2500 },
    ];

    const result = computeCompletedEventsProfit(mockEvents, mockMovements);

    // Revenue must remain at least the contracted 8000€
    assert.strictEqual(result.events[0].revenue, 8000);
    assert.strictEqual(result.events[0].costs, 2500);
    assert.strictEqual(result.events[0].profit, 5500);
  });
});
