import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseMentions,
  parseCommentSegments,
  resolveUserWatchingState,
  computeCommentNotificationPlan,
  type TeamUserItem,
} from "./moodboard-watchers";

describe("CFM Events: Moodboard Watching & Mentioning System", () => {
  const teamUsers: TeamUserItem[] = [
    { id: "usr-admin", name: "Administrador CFM", email: "admin@cfmeventos.pt" },
    { id: "usr-joao", name: "João de Noronha", email: "joao@cfmeventos.pt" },
    { id: "usr-catarina", name: "Catarina Santos", email: "catarina@cfmeventos.pt" },
    { id: "usr-madalena", name: "Madalena Rosa", email: "madalena@cfmeventos.pt" },
  ];

  test("parseMentions accurately extracts team members starting with @", () => {
    const content = "Olá @Catarina Santos e @João de Noronha, vejam estas flores!";
    const mentioned = parseMentions(content, teamUsers);

    assert.equal(mentioned.length, 2);
    assert.deepEqual(
      mentioned.map((m) => m.id).sort(),
      ["usr-catarina", "usr-joao"].sort()
    );
  });

  test("parseMentions leaves invalid mention names out (they become plain text)", () => {
    const content = "Aviso para @AlguemInexistente e @Fantasma, favor rever!";
    const mentioned = parseMentions(content, teamUsers);

    assert.equal(mentioned.length, 0);
  });

  test("parseCommentSegments distinguishes valid mentions from plain text for badges", () => {
    const content = "Boa tarde @Catarina Santos e @Desconhecido, favor verificar.";
    const segments = parseCommentSegments(content, teamUsers);

    // Should break into:
    // 1. Text: "Boa tarde "
    // 2. Mention: "@Catarina Santos"
    // 3. Text: " e @Desconhecido, favor verificar." (unrecognised mention stays plain text)
    assert.equal(segments.length, 3);
    assert.equal(segments[0].type, "text");
    assert.equal(segments[0].text, "Boa tarde ");

    assert.equal(segments[1].type, "mention");
    assert.equal(segments[1].text, "@Catarina Santos");
    if (segments[1].type === "mention") {
      assert.equal(segments[1].user.id, "usr-catarina");
    }

    assert.equal(segments[2].type, "text");
    assert.match(segments[2].text, /@Desconhecido/);
  });

  test("resolveUserWatchingState: moodboard owner is watching by default", () => {
    const board = {
      id: "med-1",
      uploadedByName: "João de Noronha",
      createdByUserId: "usr-joao",
    };

    const isWatching = resolveUserWatchingState({
      userId: "usr-joao",
      userName: "João de Noronha",
      board,
      comments: [],
    });

    assert.equal(isWatching, true);
  });

  test("resolveUserWatchingState: user who commented is watching by default", () => {
    const board = {
      id: "med-1",
      uploadedByName: "Administrador CFM",
      createdByUserId: "usr-admin",
    };

    const comments = [
      {
        userId: "usr-catarina",
        authorName: "Catarina Santos",
        content: "Gosto destas cadeiras!",
      },
    ];

    const isWatching = resolveUserWatchingState({
      userId: "usr-catarina",
      userName: "Catarina Santos",
      board,
      comments,
    });

    assert.equal(isWatching, true);
  });

  test("resolveUserWatchingState: non-owner and non-commenter is not watching by default", () => {
    const board = {
      id: "med-1",
      uploadedByName: "Administrador CFM",
      createdByUserId: "usr-admin",
    };

    const isWatching = resolveUserWatchingState({
      userId: "usr-madalena",
      userName: "Madalena Rosa",
      board,
      comments: [],
    });

    assert.equal(isWatching, false);
  });

  test("resolveUserWatchingState: user who unhitches/unwatches explicitly stays false until re-triggered", () => {
    const board = {
      id: "med-1",
      uploadedByName: "João de Noronha",
      createdByUserId: "usr-joao",
    };

    // João is the owner, but explicitly unwatched
    const isWatching = resolveUserWatchingState({
      userId: "usr-joao",
      userName: "João de Noronha",
      board,
      comments: [],
      explicitRecord: { isWatching: false },
    });

    assert.equal(isWatching, false);
  });

  test("computeCommentNotificationPlan: notifies active watchers and excludes comment author", () => {
    const board = {
      id: "med-1",
      title: "Mobiliário Lounge",
      uploadedByName: "João de Noronha",
      createdByUserId: "usr-joao",
    };

    const existingComments = [
      {
        userId: "usr-catarina",
        authorName: "Catarina Santos",
        content: "Excelente escolha!",
      },
    ];

    // João (owner) is watching by default.
    // Catarina (commenter) is watching by default.
    // Madalena hasn't interacted, so not watching.
    // Catarina comments again:
    const plan = computeCommentNotificationPlan({
      board,
      commentAuthor: { userId: "usr-catarina", name: "Catarina Santos" },
      content: "Também podíamos colocar tapetes.",
      allUsers: teamUsers,
      existingComments,
      existingWatcherRecords: [],
    });

    // Author (Catarina) should NOT receive an alert
    const recipientIds = plan.recipients.map((r) => r.user.id);
    assert.ok(!recipientIds.includes("usr-catarina"));

    // Owner (João) SHOULD receive an alert
    assert.ok(recipientIds.includes("usr-joao"));

    // Non-watcher (Madalena) should NOT receive an alert
    assert.ok(!recipientIds.includes("usr-madalena"));
  });

  test("computeCommentNotificationPlan: mentioned users automatically become watchers and receive alerts even if previously unwatched", () => {
    const board = {
      id: "med-1",
      title: "Flores",
      uploadedByName: "João de Noronha",
      createdByUserId: "usr-joao",
    };

    // Madalena had explicitly unwatched this moodboard
    const existingWatcherRecords = [
      {
        mediaId: "med-1",
        userId: "usr-madalena",
        isWatching: false,
      },
    ];

    // João comments and mentions @Madalena Rosa
    const plan = computeCommentNotificationPlan({
      board,
      commentAuthor: { userId: "usr-joao", name: "João de Noronha" },
      content: "Olá @Madalena Rosa, o que achas destas hortênsias?",
      allUsers: teamUsers,
      existingComments: [],
      existingWatcherRecords,
    });

    // Madalena must be in mentionedUsers
    assert.equal(plan.mentionedUsers.some((u) => u.id === "usr-madalena"), true);

    // Madalena's watcher record must be set to isWatching: true (source: "mention")
    const madalenaUpdate = plan.watcherUpdates.find(
      (w) => w.userId === "usr-madalena"
    );
    assert.ok(madalenaUpdate);
    assert.equal(madalenaUpdate?.isWatching, true);
    assert.equal(madalenaUpdate?.source, "mention");

    // Madalena must be in the recipients of the alert
    const madalenaRecipient = plan.recipients.find(
      (r) => r.user.id === "usr-madalena"
    );
    assert.ok(madalenaRecipient);
    assert.equal(madalenaRecipient?.isMentioned, true);
  });

  test("computeCommentNotificationPlan: unwatched user NOT mentioned does NOT receive alert", () => {
    const board = {
      id: "med-1",
      title: "Iluminação",
      uploadedByName: "João de Noronha",
      createdByUserId: "usr-joao",
    };

    // Catarina had explicitly unwatched
    const existingWatcherRecords = [
      {
        mediaId: "med-1",
        userId: "usr-catarina",
        isWatching: false,
      },
    ];

    // João comments without mentioning Catarina
    const plan = computeCommentNotificationPlan({
      board,
      commentAuthor: { userId: "usr-joao", name: "João de Noronha" },
      content: "Gosto das luzes suspensas.",
      allUsers: teamUsers,
      existingComments: [],
      existingWatcherRecords,
    });

    const recipientIds = plan.recipients.map((r) => r.user.id);
    assert.ok(!recipientIds.includes("usr-catarina"));
  });

  test("computeCommentNotificationPlan: commenting again re-watches an unwatched user", () => {
    const board = {
      id: "med-1",
      title: "Som & Palco",
      uploadedByName: "Administrador CFM",
      createdByUserId: "usr-admin",
    };

    // João had previously unwatched
    const plan = computeCommentNotificationPlan({
      board,
      commentAuthor: { userId: "usr-joao", name: "João de Noronha" },
      content: "Voltei a rever este ponto e concordo com o palco de 4x3m.",
      allUsers: teamUsers,
      existingComments: [],
      existingWatcherRecords: [
        { mediaId: "med-1", userId: "usr-joao", isWatching: false },
      ],
    });

    const joaoUpdate = plan.watcherUpdates.find((w) => w.userId === "usr-joao");
    assert.ok(joaoUpdate);
    assert.equal(joaoUpdate?.isWatching, true);
    assert.equal(joaoUpdate?.source, "comment");
  });
});
