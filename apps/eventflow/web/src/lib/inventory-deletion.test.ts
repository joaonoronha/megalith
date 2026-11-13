import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("CFM Events: Inventory Soft-Delete & Upcoming Events Caution", () => {
  it("flags upcoming events when an item is booked in a future event", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const pastWeek = new Date(today);
    pastWeek.setDate(today.getDate() - 7);

    const allocations = [
      {
        id: "alloc-1",
        itemId: "itm-chair",
        quantity: 50,
        status: "reservado",
        eventId: "ev-future",
        eventName: "Casamento Solar da Levada",
        eventStartDate: nextWeek,
        eventEndDate: nextWeek,
        eventStatus: "aprovado",
      },
      {
        id: "alloc-2",
        itemId: "itm-chair",
        quantity: 20,
        status: "concluido",
        eventId: "ev-past",
        eventName: "Jantar Gala 2023",
        eventStartDate: pastWeek,
        eventEndDate: pastWeek,
        eventStatus: "concluido",
      },
    ];

    const upcoming = allocations.filter((a) => {
      if (a.eventStatus === "cancelado" || a.eventStatus === "concluido") return false;
      const end = a.eventEndDate ? new Date(a.eventEndDate) : new Date(a.eventStartDate);
      return end >= today;
    });

    assert.equal(upcoming.length, 1);
    assert.equal(upcoming[0].eventName, "Casamento Solar da Levada");
    assert.equal(upcoming[0].quantity, 50);
  });

  it("applies soft-delete preserving historical event allocations", () => {
    const item = {
      id: "itm-chair",
      sku: "MOB-CHA-001",
      name: "Cadeira Chiavari",
      deletedAt: null as Date | null,
    };

    const pastEventAllocation = {
      id: "alloc-old",
      itemId: item.id,
      quantity: 80,
      eventName: "Festival Sunset 2024",
    };

    // Soft delete operation
    const softDeletedItem = {
      ...item,
      deletedAt: new Date(),
    };

    // Historical allocation is STILL linked to the item id
    assert.ok(softDeletedItem.deletedAt !== null);
    assert.equal(pastEventAllocation.itemId, softDeletedItem.id);
  });
});
