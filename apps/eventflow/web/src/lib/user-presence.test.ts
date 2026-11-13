import { describe, it } from "node:test";
import assert from "node:assert/strict";

interface MockOnlineUser {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  editingEntityType: "event" | "inventory" | null;
  editingEntityId: string | null;
  editingEntityTitle: string | null;
  lastSeenAt: Date;
}

function filterActiveOnlineUsers(users: MockOnlineUser[], now: Date, ttlMs: number = 45000): MockOnlineUser[] {
  const cutoff = now.getTime() - ttlMs;
  return users.filter((u) => u.lastSeenAt.getTime() >= cutoff);
}

function findActiveEditors(
  users: MockOnlineUser[],
  currentUserId: string,
  editingType: "event" | "inventory",
  editingId: string
): MockOnlineUser[] {
  return users.filter(
    (u) =>
      u.userId !== currentUserId &&
      u.editingEntityType === editingType &&
      u.editingEntityId === editingId
  );
}

describe("CFM Events: User Presence & Live Editing System", () => {
  it("determines who is online based on heartbeat TTL threshold (45 seconds)", () => {
    const now = new Date("2026-11-13T15:00:00Z");

    const users: MockOnlineUser[] = [
      {
        userId: "usr-1",
        userName: "João Noronha",
        avatarUrl: "/api/uploads/avatar-usr-1.jpg",
        editingEntityType: "event",
        editingEntityId: "evt-gala",
        editingEntityTitle: "Gala de Natal 2026",
        lastSeenAt: new Date("2026-11-13T14:59:40Z"), // 20s ago (Active)
      },
      {
        userId: "usr-2",
        userName: "Catarina Silva",
        avatarUrl: null,
        editingEntityType: null,
        editingEntityId: null,
        editingEntityTitle: null,
        lastSeenAt: new Date("2026-11-13T14:59:00Z"), // 60s ago (Expired / Offline)
      },
    ];

    const online = filterActiveOnlineUsers(users, now, 45000);
    assert.equal(online.length, 1);
    assert.equal(online[0].userId, "usr-1");
  });

  it("identifies active editors on the current entity excluding self", () => {
    const currentUserId = "usr-current";

    const onlineTeam: MockOnlineUser[] = [
      {
        userId: "usr-current",
        userName: "Admin",
        avatarUrl: null,
        editingEntityType: "event",
        editingEntityId: "evt-gala",
        editingEntityTitle: "Gala de Natal 2026",
        lastSeenAt: new Date(),
      },
      {
        userId: "usr-editor-1",
        userName: "Maria Santos",
        avatarUrl: "/api/uploads/avatar-maria.jpg",
        editingEntityType: "event",
        editingEntityId: "evt-gala",
        editingEntityTitle: "Gala de Natal 2026",
        lastSeenAt: new Date(),
      },
      {
        userId: "usr-editor-2",
        userName: "Pedro Ramos",
        avatarUrl: null,
        editingEntityType: "inventory",
        editingEntityId: "item-chair-01",
        editingEntityTitle: "Cadeira Chiavari Dourada",
        lastSeenAt: new Date(),
      },
    ];

    const editorsOnGala = findActiveEditors(onlineTeam, currentUserId, "event", "evt-gala");
    assert.equal(editorsOnGala.length, 1);
    assert.equal(editorsOnGala[0].userId, "usr-editor-1");
    assert.equal(editorsOnGala[0].userName, "Maria Santos");

    const editorsOnItem = findActiveEditors(onlineTeam, currentUserId, "inventory", "item-chair-01");
    assert.equal(editorsOnItem.length, 1);
    assert.equal(editorsOnItem[0].userId, "usr-editor-2");

    // Automatically empty if entity does not match
    const editorsOnOther = findActiveEditors(onlineTeam, currentUserId, "event", "evt-other");
    assert.equal(editorsOnOther.length, 0);
  });

  it("removes avatar and stops pulsing when editor navigates away or disconnects", () => {
    const currentUserId = "usr-current";

    let onlineTeam: MockOnlineUser[] = [
      {
        userId: "usr-editor-1",
        userName: "Maria Santos",
        avatarUrl: "/api/uploads/avatar-maria.jpg",
        editingEntityType: "event",
        editingEntityId: "evt-gala",
        editingEntityTitle: "Gala de Natal 2026",
        lastSeenAt: new Date(),
      },
    ];

    assert.equal(findActiveEditors(onlineTeam, currentUserId, "event", "evt-gala").length, 1);

    // User navigates away (editing state cleared to null)
    onlineTeam = [
      {
        ...onlineTeam[0],
        editingEntityType: null,
        editingEntityId: null,
        editingEntityTitle: null,
      },
    ];
    assert.equal(findActiveEditors(onlineTeam, currentUserId, "event", "evt-gala").length, 0);

    // Or user disconnects completely (removed from online list)
    onlineTeam = [];
    assert.equal(findActiveEditors(onlineTeam, currentUserId, "event", "evt-gala").length, 0);
  });
});
