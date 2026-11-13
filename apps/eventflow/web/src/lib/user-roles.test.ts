import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { UserRole } from "./auth";

/**
 * CFM Events Permission and Role Logic Tests
 *
 * Requirements:
 * - Owner: can edit everything, including creating users, editing any account,
 *   assigning/changing roles, and managing all business logic.
 * - Admin: can only edit themselves (their own name, email, password, photo).
 *   Admins CANNOT remove admin permissions from other users, cannot edit other users'
 *   information or photos, cannot assign roles.
 *   Admins retain full permissions to edit inventory, events, quotes, and all business logic.
 * - Producer / Warehouse: can only edit their own account photo and details.
 */

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
}

function canCreateUser(actor: User): boolean {
  return actor.role === "owner";
}

function canEditOtherUser(actor: User, targetUser: User): boolean {
  if (actor.id === targetUser.id) return true;
  return actor.role === "owner";
}

function canChangeRole(actor: User): boolean {
  return actor.role === "owner";
}

function canChangeUserPhoto(actor: User, targetUser: User): boolean {
  if (actor.id === targetUser.id) return true;
  return actor.role === "owner";
}

function canEditBusinessLogic(actor: User): boolean {
  // Business logic (inventory, events, quotes, finances)
  return actor.role === "owner" || actor.role === "admin";
}

function resolveUserUpdate(
  actor: User,
  targetUser: User,
  updates: { name?: string; email?: string; role?: UserRole }
): { success: boolean; error?: string; updated?: Partial<User> } {
  const isSelf = actor.id === targetUser.id;
  const isOwner = actor.role === "owner";

  if (!isSelf && !isOwner) {
    return {
      success: false,
      error: "Apenas o Programador tem permissão para alterar contas de outros membros.",
    };
  }

  // Determine final role: only owner can change roles
  const finalRole = isOwner && updates.role ? updates.role : targetUser.role;

  return {
    success: true,
    updated: {
      name: updates.name ?? targetUser.name,
      email: updates.email ?? targetUser.email,
      role: finalRole,
    },
  };
}

describe("CFM Events: Owner & Admin Role Permissions Matrix", () => {
  const ownerUser: User = {
    id: "usr-owner-1",
    name: "Programador CFM",
    email: "owner@cfmeventos.pt",
    role: "owner",
  };

  const adminUser1: User = {
    id: "usr-admin-1",
    name: "Administrador 1",
    email: "admin1@cfmeventos.pt",
    role: "admin",
  };

  const adminUser2: User = {
    id: "usr-admin-2",
    name: "Administrador 2",
    email: "admin2@cfmeventos.pt",
    role: "admin",
  };

  const producerUser: User = {
    id: "usr-producer-1",
    name: "Produtor Pedro",
    email: "pedro@cfmeventos.pt",
    role: "producer",
  };

  it("Owner can create accounts and assign any role", () => {
    assert.strictEqual(canCreateUser(ownerUser), true);
    assert.strictEqual(canChangeRole(ownerUser), true);
  });

  it("Admin cannot create accounts or assign roles", () => {
    assert.strictEqual(canCreateUser(adminUser1), false);
    assert.strictEqual(canChangeRole(adminUser1), false);
  });

  it("Admin can only edit their own account details and photo", () => {
    // Admin editing self
    assert.strictEqual(canEditOtherUser(adminUser1, adminUser1), true);
    assert.strictEqual(canChangeUserPhoto(adminUser1, adminUser1), true);

    const selfUpdate = resolveUserUpdate(adminUser1, adminUser1, {
      name: "Admin Atualizado",
      email: "novo@cfmeventos.pt",
      role: "owner", // attempting self-elevation to owner
    });

    assert.strictEqual(selfUpdate.success, true);
    assert.strictEqual(selfUpdate.updated?.name, "Admin Atualizado");
    // Role must remain admin because non-owner cannot change role!
    assert.strictEqual(selfUpdate.updated?.role, "admin");
  });

  it("Admin CANNOT edit other users' information or photo", () => {
    assert.strictEqual(canEditOtherUser(adminUser1, adminUser2), false);
    assert.strictEqual(canChangeUserPhoto(adminUser1, adminUser2), false);
    assert.strictEqual(canEditOtherUser(adminUser1, producerUser), false);

    const attempt = resolveUserUpdate(adminUser1, adminUser2, {
      name: "Tentativa de Edição",
    });
    assert.strictEqual(attempt.success, false);
    assert.match(attempt.error || "", /Apenas o Programador/);
  });

  it("Admin CANNOT remove admin permissions or alter roles of other users", () => {
    const attemptDemote = resolveUserUpdate(adminUser1, adminUser2, {
      role: "producer",
    });
    assert.strictEqual(attemptDemote.success, false);
  });

  it("Owner can edit any user's profile and reassign roles", () => {
    assert.strictEqual(canEditOtherUser(ownerUser, adminUser1), true);
    assert.strictEqual(canChangeUserPhoto(ownerUser, adminUser1), true);

    const ownerUpdate = resolveUserUpdate(ownerUser, adminUser1, {
      name: "Admin Promovido",
      role: "producer",
    });
    assert.strictEqual(ownerUpdate.success, true);
    assert.strictEqual(ownerUpdate.updated?.role, "producer");
  });

  it("Both Owner and Admin retain full permissions to edit business logic (events, inventory, quotes, finances)", () => {
    assert.strictEqual(canEditBusinessLogic(ownerUser), true);
    assert.strictEqual(canEditBusinessLogic(adminUser1), true);
    assert.strictEqual(canEditBusinessLogic(producerUser), false);
  });
});
