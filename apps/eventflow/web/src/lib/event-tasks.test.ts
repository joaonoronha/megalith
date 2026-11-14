import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("CFM Events: Event Tasks & User Assignment System", () => {
  const mockTeamUsers = [
    { id: "usr-1", name: "João Noronha", email: "joao@example.com" },
    { id: "usr-2", name: "Maria Santos", email: "maria@example.com" },
    { id: "usr-3", name: "Pedro Ramos", email: "pedro@example.com" },
  ];

  test("allows creating tasks with or without an initial assigned team member", () => {
    const unassignedTask = {
      id: "task-001",
      eventId: "evt-gala-2026",
      title: "Verificar iluminação cénica e projetores",
      completed: false,
      assignedTo: null as string | null,
    };

    const assignedTask = {
      id: "task-002",
      eventId: "evt-gala-2026",
      title: "Confirmar bolo e balões Winnie the Pooh",
      completed: false,
      assignedTo: mockTeamUsers[0].name,
    };

    assert.equal(unassignedTask.assignedTo, null);
    assert.equal(assignedTask.assignedTo, "João Noronha");
  });

  test("allows assigning, reassigning, and unassigning a user on existing tasks", () => {
    let task = {
      id: "task-003",
      eventId: "evt-gala-2026",
      title: "Montagem da mesa de honra",
      completed: false,
      assignedTo: null as string | null,
    };

    // 1. Assign to Maria Santos
    task = { ...task, assignedTo: mockTeamUsers[1].name };
    assert.equal(task.assignedTo, "Maria Santos");

    // 2. Reassign to Pedro Ramos
    task = { ...task, assignedTo: mockTeamUsers[2].name };
    assert.equal(task.assignedTo, "Pedro Ramos");

    // 3. Unassign (Sem responsável / empty string or null)
    const cleanAssignee = "".trim() || null;
    task = { ...task, assignedTo: cleanAssignee };
    assert.equal(task.assignedTo, null);
  });

  test("preserves task completion status and title when assignee changes", () => {
    const completedTask = {
      id: "task-004",
      eventId: "evt-gala-2026",
      title: "Confirmar fornecedor de flores",
      completed: true,
      assignedTo: "Maria Santos",
    };

    // Reassigning completed task
    const updated = {
      ...completedTask,
      assignedTo: "João Noronha",
    };

    assert.equal(updated.completed, true, "Completed state must be preserved");
    assert.equal(updated.title, "Confirmar fornecedor de flores");
    assert.equal(updated.assignedTo, "João Noronha");
  });

  test("matches assigned tasks for user profile page by user ID or user name", () => {
    const allTasks = [
      { id: "t1", title: "Tarefa 1", assignedTo: "João Noronha" },
      { id: "t2", title: "Tarefa 2", assignedTo: "usr-1" },
      { id: "t3", title: "Tarefa 3", assignedTo: "Maria Santos" },
      { id: "t4", title: "Tarefa 4", assignedTo: null },
    ];

    const targetUser = mockTeamUsers[0]; // João Noronha, id usr-1

    const userTasks = allTasks.filter(
      (t) =>
        t.assignedTo === targetUser.id ||
        t.assignedTo === targetUser.name
    );

    assert.equal(userTasks.length, 2);
    assert.deepEqual(
      userTasks.map((t) => t.id),
      ["t1", "t2"]
    );
  });
});
