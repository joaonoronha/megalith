import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getClientBoundEvents,
  formatClientDeletionWarning,
  ClientBoundEvent,
} from "./customer-deletion";

describe("CFM Events: Customer Deletion & Event Binding Warning Rules", () => {
  const sampleEvents: ClientBoundEvent[] = [
    {
      id: "evt-gala",
      name: "Mastercard Gala 2026",
      clientId: "cli-mastercard",
      status: "confirmado",
    },
    {
      id: "evt-pooh",
      name: "Festa Winnie the Pooh",
      clientId: "cli-marta",
      status: "planeamento",
    },
    {
      id: "evt-wedding",
      name: "Casamento Solar da Levada",
      clientId: "cli-marta",
      status: "preparacao",
    },
    {
      id: "evt-unassigned",
      name: "Gala de Natal Empresa",
      clientId: null,
      status: "orcamento",
    },
  ];

  it("identifies events assigned to a specific customer", () => {
    const martaEvents = getClientBoundEvents("cli-marta", sampleEvents);
    assert.equal(martaEvents.length, 2);
    assert.deepEqual(
      martaEvents.map((e) => e.name),
      ["Festa Winnie the Pooh", "Casamento Solar da Levada"]
    );

    const mastercardEvents = getClientBoundEvents("cli-mastercard", sampleEvents);
    assert.equal(mastercardEvents.length, 1);
    assert.equal(mastercardEvents[0].name, "Mastercard Gala 2026");

    const unusedClientEvents = getClientBoundEvents("cli-free", sampleEvents);
    assert.equal(unusedClientEvents.length, 0);
  });

  it("formats standard confirmation message when customer is not bound to any event", () => {
    const warning = formatClientDeletionWarning("Empresa ABC", []);
    assert.equal(warning.hasBoundEvents, false);
    assert.equal(warning.boundEventsCount, 0);
    assert.equal(warning.headline, "Eliminar Empresa ABC");
    assert.ok(warning.detail.includes("permanente"));
  });

  it("shows specific warning when customer is bound to exactly one event", () => {
    const bound = [{ id: "evt-gala", name: "Mastercard Gala 2026" }];
    const warning = formatClientDeletionWarning("Mastercard Portugal", bound);

    assert.equal(warning.hasBoundEvents, true);
    assert.equal(warning.boundEventsCount, 1);
    assert.equal(warning.specificEventName, "Mastercard Gala 2026");
    assert.ok(warning.headline.includes("Cliente associado a evento"));
    assert.ok(warning.detail.includes('associado ao evento "Mastercard Gala 2026"'));
    assert.ok(warning.detail.includes("desvinculado do evento"));
  });

  it("shows detailed warning when customer is bound to multiple events", () => {
    const bound = [
      { id: "evt-pooh", name: "Festa Winnie the Pooh" },
      { id: "evt-wedding", name: "Casamento Solar da Levada" },
    ];
    const warning = formatClientDeletionWarning("Marta Almeida", bound);

    assert.equal(warning.hasBoundEvents, true);
    assert.equal(warning.boundEventsCount, 2);
    assert.ok(warning.headline.includes("2 eventos"));
    assert.ok(warning.detail.includes('"Festa Winnie the Pooh", "Casamento Solar da Levada"'));
    assert.ok(warning.detail.includes("desvinculado destes eventos"));
  });
});
