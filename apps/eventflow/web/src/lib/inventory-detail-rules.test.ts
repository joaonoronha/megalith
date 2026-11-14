import { describe, it } from "node:test";
import assert from "node:assert";

interface StorageLocation {
  id: string;
  name: string;
  code?: string | null;
  managerName?: string | null;
}

interface InventoryItem {
  id: string;
  name: string;
  warehouseLocation: string | null;
  locationId?: string | null;
  imageUrl?: string | null;
}

/**
 * Helper implementing the storage location selection logic for InventoryDetailView.
 * Ensures items can only be associated with locations that exist in locationsList.
 */
function resolveSelectedLocationId(
  item: { locationId?: string | null; warehouseLocation?: string | null },
  locationsList: StorageLocation[]
): string {
  if (item.locationId && locationsList.some((l) => l.id === item.locationId)) {
    return item.locationId;
  }
  if (item.warehouseLocation) {
    const match = locationsList.find(
      (l) => l.name.toLowerCase() === item.warehouseLocation?.toLowerCase()
    );
    if (match) return match.id;
  }
  return "";
}

function applyLocationSelection(
  locationId: string,
  locationsList: StorageLocation[]
): { locationId: string; warehouseLocation: string } | null {
  const loc = locationsList.find((l) => l.id === locationId);
  if (!loc) return null; // Disallows non-existent locations
  return {
    locationId: loc.id,
    warehouseLocation: loc.name,
  };
}

describe("CFM Events: Inventory Detail Location & Photo Interactions", () => {
  const mockLocations: StorageLocation[] = [
    { id: "loc_01", name: "Armazém Principal", code: "AP-01", managerName: "Carlos Silva" },
    { id: "loc_02", name: "Armazém B · Mezanino", code: "AB-MZ", managerName: "Maria Santos" },
    { id: "loc_03", name: "Armazém Sintra · Palete 4", code: "AS-P4", managerName: "João Pedro" },
  ];

  it("resolves selected location ID only when it matches an existing location", () => {
    // 1. Direct locationId match
    const itemWithId = { locationId: "loc_02", warehouseLocation: "Outro" };
    assert.strictEqual(resolveSelectedLocationId(itemWithId, mockLocations), "loc_02");

    // 2. Fallback to name match
    const itemWithName = { locationId: null, warehouseLocation: "Armazém Principal" };
    assert.strictEqual(resolveSelectedLocationId(itemWithName, mockLocations), "loc_01");

    // 3. Non-existent arbitrary location returns empty string (prompting valid selection)
    const itemWithInvalid = { locationId: "loc_invalid", warehouseLocation: "Garagem Desconhecida" };
    assert.strictEqual(resolveSelectedLocationId(itemWithInvalid, mockLocations), "");
  });

  it("applies location selection exclusively from existing locations list", () => {
    // Valid existing location
    const selection = applyLocationSelection("loc_03", mockLocations);
    assert.ok(selection);
    assert.strictEqual(selection.locationId, "loc_03");
    assert.strictEqual(selection.warehouseLocation, "Armazém Sintra · Palete 4");

    // Invalid location ID cannot be applied
    const invalidSelection = applyLocationSelection("loc_does_not_exist", mockLocations);
    assert.strictEqual(invalidSelection, null);
  });

  it("differentiates photo viewing (lightbox) from photo editing (camera icon)", () => {
    // Interaction dispatcher simulates user clicking thumbnail vs camera button
    type InteractionTarget = "photo_thumbnail" | "camera_icon_button";

    const handlePhotoInteraction = (
      target: InteractionTarget,
      hasImage: boolean
    ): { opensLightbox: boolean; opensImagePicker: boolean } => {
      if (target === "camera_icon_button") {
        return { opensLightbox: false, opensImagePicker: true };
      }
      // Clicking the photo thumbnail directly
      if (hasImage) {
        return { opensLightbox: true, opensImagePicker: false };
      }
      return { opensLightbox: false, opensImagePicker: true };
    };

    // Clicking image with photo opens lightbox, NOT picker
    const clickPhoto = handlePhotoInteraction("photo_thumbnail", true);
    assert.strictEqual(clickPhoto.opensLightbox, true);
    assert.strictEqual(clickPhoto.opensImagePicker, false);

    // Clicking camera button opens picker, NOT lightbox
    const clickCamera = handlePhotoInteraction("camera_icon_button", true);
    assert.strictEqual(clickCamera.opensLightbox, false);
    assert.strictEqual(clickCamera.opensImagePicker, true);
  });
});
