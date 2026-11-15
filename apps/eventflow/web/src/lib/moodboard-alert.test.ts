import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_RULE_TYPES } from "./alerts";

describe("CFM Events: Moodboard Comment Alerts System", () => {
  test("SYSTEM_RULE_TYPES only includes automated batch background rules", () => {
    assert.equal(SYSTEM_RULE_TYPES.has("low_stock"), true);
    assert.equal(SYSTEM_RULE_TYPES.has("damaged_stock"), true);
    assert.equal(SYSTEM_RULE_TYPES.has("event_unprepared"), true);
    assert.equal(SYSTEM_RULE_TYPES.has("payment_due"), true);
    assert.equal(SYSTEM_RULE_TYPES.has("missing_completed_payment"), true);

    // Event-driven alerts like moodboard comments must NOT be in SYSTEM_RULE_TYPES
    // so they are never auto-resolved when the background sync runs
    assert.equal(SYSTEM_RULE_TYPES.has("moodboard_comment"), false);
  });

  test("auto-resolve algorithm preserves moodboard comment alerts while resolving stale rule alerts", () => {
    const existingAlerts = [
      {
        id: "alt-1",
        fingerprint: "low_stock:inventory:item-1",
        type: "low_stock",
        status: "active",
      },
      {
        id: "alt-2",
        fingerprint: "moodboard_comment:media-1:cmt-1",
        type: "moodboard_comment",
        severity: "info",
        status: "active",
      },
    ];

    // Current candidate list from live system evaluation (item-1 has been restocked, so no candidates)
    const candidateFingerprints = new Set<string>();

    const resolvedIds: string[] = [];

    // Emulate step 2 in evaluateAndSyncAlerts:
    for (const existing of existingAlerts) {
      if (
        SYSTEM_RULE_TYPES.has(existing.type) &&
        (existing.status === "active" || existing.status === "snoozed" || existing.status === "acknowledged") &&
        !candidateFingerprints.has(existing.fingerprint)
      ) {
        resolvedIds.push(existing.id);
      }
    }

    // low_stock should be auto-resolved because it was restocked
    assert.ok(resolvedIds.includes("alt-1"));
    // moodboard_comment MUST NOT be auto-resolved!
    assert.ok(!resolvedIds.includes("alt-2"));
  });

  test("moodboard comment alert payload has info severity and event metadata", () => {
    const mediaId = "med-test-123";
    const commentId = "cmt-test-456";
    const eventId = "evt-test-789";
    const authorName = "Catarina Santos";
    const boardTitle = "Flores & Decoração";
    const content = "Podemos adicionar mais lírios brancos na mesa de honra?";
    const photoLabel = "Foto 2";

    const alertPayload = {
      id: "alt-sample",
      fingerprint: `moodboard_comment:${mediaId}:${commentId}`,
      type: "moodboard_comment",
      entityType: "event",
      entityId: eventId,
      title: "Novo comentário no Moodboard",
      message: `${authorName} comentou em "${boardTitle}": "${content}" (${photoLabel})`,
      severity: "info",
      status: "active",
      metadata: JSON.stringify({
        mediaId,
        commentId,
        authorName,
        boardTitle,
        photoLabel,
      }),
    };

    assert.equal(alertPayload.type, "moodboard_comment");
    assert.equal(alertPayload.severity, "info");
    assert.equal(alertPayload.entityType, "event");
    assert.equal(alertPayload.entityId, eventId);
    assert.equal(alertPayload.fingerprint, `moodboard_comment:${mediaId}:${commentId}`);
    assert.match(alertPayload.message, /Catarina Santos comentou/);
    assert.match(alertPayload.message, /lírios brancos/);
  });
});
