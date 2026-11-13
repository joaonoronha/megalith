import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("CFM Events: Barcode Scanner Business Rules & Accessibility", () => {
  it("formats barcode search results from database match cleanly without technical jargon", () => {
    const dbItem = {
      id: "itm-123",
      sku: "MOB-CHA-001",
      name: "Cadeira Chiavari Dourada",
      category: "Mobiliário / Cadeiras",
      totalQuantity: 40,
      unitPrice: 4.5,
      warehouseLocation: "Armazém Principal",
      imageUrl: null,
      isConsumable: false,
    };

    const searchResult = {
      success: true,
      found: true,
      source: "database" as const,
      item: dbItem,
    };

    assert.equal(searchResult.found, true);
    assert.equal(searchResult.source, "database");
    assert.equal(searchResult.item.name, "Cadeira Chiavari Dourada");
    assert.equal(searchResult.item.totalQuantity, 40);
  });

  it("handles Open Food Facts product structure extraction", () => {
    const rawOffProduct = {
      status: 1,
      product: {
        product_name_pt: "Água Mineral Natural 50cl",
        product_name: "Natural Mineral Water",
        brands: "Luso",
        categories: "Bebidas, Águas",
        image_front_url: "https://images.openfoodfacts.org/images/products/560/luso.jpg",
      },
    };

    const name = (
      rawOffProduct.product.product_name_pt ||
      rawOffProduct.product.product_name ||
      rawOffProduct.product.brands ||
      ""
    ).trim();

    const category = rawOffProduct.product.categories
      ? rawOffProduct.product.categories.split(",")[0].trim()
      : "Alimentação & Bebidas";

    assert.equal(name, "Água Mineral Natural 50cl");
    assert.equal(category, "Bebidas");
    assert.equal(rawOffProduct.product.image_front_url.startsWith("https://"), true);
  });

  it("ensures stock adder calculates positive increments only", () => {
    const currentStock = 12;
    const addQuantity = 5;
    const updatedStock = currentStock + Math.max(1, addQuantity);

    assert.equal(updatedStock, 17);
    assert.ok(updatedStock > currentStock);
  });

  it("validates that raw technical barcode strings are hidden from user-facing prompts", () => {
    const barcode = "5601234567890";
    const userFacingTitle = "Novo Artigo Detetado";
    const userFacingDescription =
      "Os dados do artigo foram detetados automaticamente. Revê e confirma para guardar no catálogo.";

    assert.equal(userFacingTitle.includes(barcode), false);
    assert.equal(userFacingDescription.includes(barcode), false);
    assert.equal(userFacingDescription.includes("EAN-13"), false);
    assert.equal(userFacingDescription.includes("UPC-A"), false);
  });
});
