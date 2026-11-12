import { test, describe } from "node:test";
import assert from "node:assert";

describe("CFM Events: Event Custom Items & Quota Integration", () => {
  interface CustomItem {
    id: string;
    eventId: string;
    name: string;
    category: string;
    quantity: number;
    unitCost: number;
    unitPrice: number;
    supplier?: string;
    notes?: string;
  }

  test("calculates direct financial impact of custom items on event quota and budget", () => {
    const customItem: CustomItem = {
      id: "eci_neon_01",
      eventId: "evt-casamento-rita",
      name: "Letreiro Néon 'Better Together'",
      category: "Audiovisuais & Iluminação",
      quantity: 1,
      unitCost: 180.0, // CFM purchase cost
      unitPrice: 350.0, // Quota price charged to client
      supplier: "Neon Studio Lisboa",
      notes: "Luz branca quente, 120x45cm",
    };

    const initialCustomerPrice = 4500.0;
    const initialTotalBudget = 2200.0;

    const addedPrice = customItem.quantity * customItem.unitPrice;
    const addedCost = customItem.quantity * customItem.unitCost;

    const updatedCustomerPrice = initialCustomerPrice + addedPrice;
    const updatedTotalBudget = initialTotalBudget + addedCost;

    const initialMargin = initialCustomerPrice - initialTotalBudget;
    const updatedMargin = updatedCustomerPrice - updatedTotalBudget;
    const itemMargin = addedPrice - addedCost;

    assert.strictEqual(addedPrice, 350.0);
    assert.strictEqual(addedCost, 180.0);
    assert.strictEqual(updatedCustomerPrice, 4850.0);
    assert.strictEqual(updatedTotalBudget, 2380.0);
    assert.strictEqual(updatedMargin, initialMargin + itemMargin);
    assert.strictEqual(itemMargin, 170.0);
  });

  test("custom items do not pollute general warehouse inventory", () => {
    const warehouseInventory = [
      { id: "itm_1", name: "Cadeira Chiavari", sku: "CHA-01", totalQuantity: 100 },
      { id: "itm_2", name: "Mesa Redonda 180cm", sku: "TAB-01", totalQuantity: 20 },
    ];

    const eventCustomItem: CustomItem = {
      id: "eci_floral_01",
      eventId: "evt-batizado-tomas",
      name: "Arranjos Florais Especiais Hortênsias Azuis",
      category: "Flores & Decoração",
      quantity: 8,
      unitCost: 35.0,
      unitPrice: 65.0,
      supplier: "Florista Quinta das Flores",
    };

    // Verify warehouse inventory does not contain the bespoke item
    const existsInWarehouse = warehouseInventory.some(
      (item) => item.name === eventCustomItem.name || item.id === eventCustomItem.id
    );
    assert.strictEqual(existsInWarehouse, false);
    assert.strictEqual(warehouseInventory.length, 2);
  });

  test("generates quote lines directly from event allocations and custom items", () => {
    const allocations = [
      { id: "alc_1", itemId: "itm_1", itemName: "Cadeiras Chiavari", quantity: 50, itemUnitPrice: 6.0 },
    ];

    const customItems: CustomItem[] = [
      {
        id: "eci_cake_01",
        eventId: "evt-aniversario-carmo",
        name: "Bolo Artístico 3 Andares Cenográfico",
        category: "Catering & Bolo",
        quantity: 1,
        unitCost: 150.0,
        unitPrice: 320.0,
      },
      {
        id: "eci_sign_01",
        eventId: "evt-aniversario-carmo",
        name: "Painel de Boas-Vindas Acrílico Espelhado",
        category: "Sinalética & Gráfica",
        quantity: 1,
        unitCost: 45.0,
        unitPrice: 110.0,
      },
    ];

    interface QuoteLine {
      itemId?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }

    const lines: QuoteLine[] = [];

    // 1. Warehouse items
    allocations.forEach((a) => {
      lines.push({
        itemId: a.itemId,
        description: a.itemName,
        quantity: a.quantity,
        unitPrice: a.itemUnitPrice,
        total: a.quantity * a.itemUnitPrice,
      });
    });

    // 2. Custom bespoke items
    customItems.forEach((c) => {
      lines.push({
        description: `${c.name} (${c.category})`,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        total: c.quantity * c.unitPrice,
      });
    });

    const subtotal = lines.reduce((acc, l) => acc + l.total, 0);
    const vatRate = 0.23;
    const vatAmount = subtotal * vatRate;
    const total = subtotal + vatAmount;

    assert.strictEqual(lines.length, 3);
    assert.strictEqual(lines[0].total, 300.0); // 50 * 6
    assert.strictEqual(lines[1].total, 320.0); // 1 * 320
    assert.strictEqual(lines[2].total, 110.0); // 1 * 110
    assert.strictEqual(subtotal, 730.0);
    assert.strictEqual(vatAmount, 167.9);
    assert.strictEqual(total, 897.9);
  });

  test("handles quantity and price adjustments when custom items are updated or removed", () => {
    let customerPrice = 5000.0;
    let totalBudget = 2500.0;

    const initialItem: CustomItem = {
      id: "eci_tenda_01",
      eventId: "evt-gala-verao",
      name: "Tenda Stretch Bedouin 10x15m",
      category: "Estruturas & Tendas",
      quantity: 1,
      unitCost: 800.0,
      unitPrice: 1500.0,
    };

    // Add item
    customerPrice += initialItem.quantity * initialItem.unitPrice;
    totalBudget += initialItem.quantity * initialItem.unitCost;
    assert.strictEqual(customerPrice, 6500.0);
    assert.strictEqual(totalBudget, 3300.0);

    // Update item (quantity increased to 2)
    const updatedQty = 2;
    const diffPrice = (updatedQty - initialItem.quantity) * initialItem.unitPrice;
    const diffCost = (updatedQty - initialItem.quantity) * initialItem.unitCost;
    customerPrice += diffPrice;
    totalBudget += diffCost;
    assert.strictEqual(customerPrice, 8000.0);
    assert.strictEqual(totalBudget, 4100.0);

    // Remove item completely
    const removedPrice = updatedQty * initialItem.unitPrice;
    const removedCost = updatedQty * initialItem.unitCost;
    customerPrice -= removedPrice;
    totalBudget -= removedCost;
    assert.strictEqual(customerPrice, 5000.0);
    assert.strictEqual(totalBudget, 2500.0);
  });
});
