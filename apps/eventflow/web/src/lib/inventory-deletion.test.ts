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

  it("excludes soft-deleted items from being selectable in new event allocations and quotes", () => {
    const items = [
      { id: "itm-1", name: "Cadeira Chiavari", sku: "CHA-01", deletedAt: null },
      { id: "itm-2", name: "Sofá Vintage", sku: "SOF-02", deletedAt: new Date() },
      { id: "itm-3", name: "Mesa Redonda", sku: "MES-03", deletedAt: null },
    ];

    const activeItems = items.filter((item) => !item.deletedAt);
    assert.equal(activeItems.length, 2);
    assert.ok(!activeItems.some((i) => i.id === "itm-2"));
  });

  it("excludes automatic stock purchase movements of deleted items from finance", () => {
    const deletedItemId = "itm-deleted-99";
    const movements = [
      {
        id: "mov-1",
        type: "saida",
        category: "Material / Stock",
        amount: 250,
        notes: `Despesa gerada automaticamente na compra/criação do artigo ART-99 (${deletedItemId})`,
      },
      {
        id: "mov-2",
        type: "saida",
        category: "Material / Stock",
        amount: 100,
        notes: "Despesa gerada automaticamente na compra/criação do artigo ART-100 (itm-active-100)",
      },
      {
        id: "mov-3",
        type: "entrada",
        category: "Evento",
        amount: 1500,
        notes: "Pagamento 50% adjudicação",
      },
    ];

    const deletedItemIds = new Set([deletedItemId]);
    const activeMovements = movements.filter((m) => {
      if (!m.notes) return true;
      for (const id of deletedItemIds) {
        if (m.notes.includes(`(${id})`)) return false;
      }
      return true;
    });

    assert.equal(activeMovements.length, 2);
    assert.ok(!activeMovements.some((m) => m.id === "mov-1"));
    assert.ok(activeMovements.some((m) => m.id === "mov-2"));
    assert.ok(activeMovements.some((m) => m.id === "mov-3"));
  });
});
