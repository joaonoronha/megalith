/**
 * Moodboard Watching & Mentioning Business Rules
 *
 * Rules:
 * 1. A user is watching a moodboard if:
 *    - they are the owner/creator of the moodboard
 *    - they have commented on the moodboard
 *    - they were mentioned in a comment on the moodboard
 *    - they manually toggled the watch state to active
 * 2. Users watching the moodboard receive an alert when someone else comments.
 * 3. Mentioned users automatically become watching.
 * 4. Users can unwatch themselves. They only re-watch if they comment again or are mentioned.
 * 5. Mentioning requires starting with @ and matching an available team member.
 *    Invalid names remain plain text without a badge.
 */

export interface TeamUserItem {
  id: string;
  name: string;
  email?: string;
  role?: string;
  avatarUrl?: string | null;
}

export interface MoodboardCommentLike {
  id?: string;
  userId?: string | null;
  authorName: string;
  content: string;
}

export interface WatcherRecordLike {
  mediaId: string;
  userId: string;
  isWatching: boolean;
  source?: string | null;
  updatedAt?: Date | string | null;
}

/**
 * Normalizes text for comparison (removes accents, trims, lowercases)
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Extracts valid mentioned team members from comment content.
 * Matches @Name against available teamUsers.
 * If a mention doesn't match any team user, it is ignored here.
 */
export function parseMentions(
  content: string,
  teamUsers: TeamUserItem[]
): TeamUserItem[] {
  if (!content || !teamUsers || teamUsers.length === 0) return [];

  // Sort team users by name length descending so longer names match first
  const sortedUsers = [...teamUsers].sort(
    (a, b) => b.name.trim().length - a.name.trim().length
  );

  const matchedUsers: TeamUserItem[] = [];
  const matchedIds = new Set<string>();

  // Look for @ occurrences
  const atIndices: number[] = [];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "@" && (i === 0 || /\s|[.,;:!?([{"']/.test(content[i - 1]))) {
      atIndices.push(i);
    }
  }

  for (const atIdx of atIndices) {
    const afterAt = content.slice(atIdx + 1);

    for (const user of sortedUsers) {
      if (matchedIds.has(user.id)) continue;

      const userName = user.name.trim();
      const userNameNorm = normalizeName(userName);
      const afterAtPrefix = afterAt.slice(0, userName.length);
      const afterAtPrefixNorm = normalizeName(afterAtPrefix);

      if (afterAtPrefixNorm === userNameNorm) {
        // Ensure the character right after the name is word boundary or punctuation/space/end
        const nextChar = afterAt[userName.length];
        if (!nextChar || /\s|[.,;:!?)]/.test(nextChar)) {
          matchedUsers.push(user);
          matchedIds.add(user.id);
          break;
        }
      }
    }
  }

  return matchedUsers;
}

/**
 * Parses comment text into structured segments for rendering.
 * Valid mentions become { type: "mention", user }, while unrecognised names stay { type: "text" }.
 */
export type CommentTextSegment =
  | { type: "text"; text: string }
  | { type: "mention"; text: string; user: TeamUserItem };

export function parseCommentSegments(
  content: string,
  teamUsers: TeamUserItem[]
): CommentTextSegment[] {
  if (!content) return [];
  if (!teamUsers || teamUsers.length === 0) {
    return [{ type: "text", text: content }];
  }

  const sortedUsers = [...teamUsers].sort(
    (a, b) => b.name.trim().length - a.name.trim().length
  );

  const segments: CommentTextSegment[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const atIdx = content.indexOf("@", cursor);
    if (atIdx === -1) {
      segments.push({ type: "text", text: content.slice(cursor) });
      break;
    }

    // Must be preceded by start of string or whitespace / punctuation
    const isPrecededByBoundary =
      atIdx === 0 || /\s|[.,;:!?([{"']/.test(content[atIdx - 1]);

    if (!isPrecededByBoundary) {
      segments.push({ type: "text", text: content.slice(cursor, atIdx + 1) });
      cursor = atIdx + 1;
      continue;
    }

    // Add any preceding text
    if (atIdx > cursor) {
      segments.push({ type: "text", text: content.slice(cursor, atIdx) });
    }

    const afterAt = content.slice(atIdx + 1);
    let foundUser: TeamUserItem | null = null;
    let matchLength = 0;

    for (const user of sortedUsers) {
      const userName = user.name.trim();
      const userNameNorm = normalizeName(userName);
      const afterAtPrefix = afterAt.slice(0, userName.length);
      const afterAtPrefixNorm = normalizeName(afterAtPrefix);

      if (afterAtPrefixNorm === userNameNorm) {
        const nextChar = afterAt[userName.length];
        if (!nextChar || /\s|[.,;:!?)]/.test(nextChar)) {
          foundUser = user;
          matchLength = 1 + userName.length; // 1 for '@'
          break;
        }
      }
    }

    if (foundUser) {
      segments.push({
        type: "mention",
        text: content.slice(atIdx, atIdx + matchLength),
        user: foundUser,
      });
      cursor = atIdx + matchLength;
    } else {
      // Unrecognized mention: remains plain text
      segments.push({ type: "text", text: "@" });
      cursor = atIdx + 1;
    }
  }

  // Combine contiguous plain text segments for efficiency
  const condensed: CommentTextSegment[] = [];
  for (const seg of segments) {
    const last = condensed[condensed.length - 1];
    if (last && last.type === "text" && seg.type === "text") {
      last.text += seg.text;
    } else {
      condensed.push(seg);
    }
  }

  return condensed;
}

/**
 * Resolves whether a specific user is currently watching a moodboard.
 */
export function resolveUserWatchingState({
  userId,
  userName,
  board,
  comments = [],
  explicitRecord,
}: {
  userId?: string | null;
  userName?: string | null;
  board: {
    id: string;
    uploadedByName?: string | null;
    createdByUserId?: string | null;
  };
  comments?: MoodboardCommentLike[];
  explicitRecord?: { isWatching: boolean } | null;
}): boolean {
  // If user has an explicit record in moodboard_watchers, that is authoritative
  if (explicitRecord !== undefined && explicitRecord !== null) {
    return Boolean(explicitRecord.isWatching);
  }

  const cleanUserName = userName ? normalizeName(userName) : "";
  const cleanUploadedByName = board.uploadedByName
    ? normalizeName(board.uploadedByName)
    : "";

  // 1. Owner of the moodboard
  const isOwner =
    (Boolean(userId) && Boolean(board.createdByUserId) && board.createdByUserId === userId) ||
    (Boolean(cleanUserName) && cleanUserName === cleanUploadedByName);

  if (isOwner) return true;

  // 2. Has commented on the moodboard
  const hasCommented = comments.some((c) => {
    if (userId && c.userId && c.userId === userId) return true;
    if (cleanUserName && c.authorName && normalizeName(c.authorName) === cleanUserName) return true;
    return false;
  });

  if (hasCommented) return true;

  return false;
}

/**
 * Computes which watchers should receive notification alerts when a new comment is posted.
 * Also returns watcher status updates (e.g. author and mentioned users becoming active watchers).
 */
export function computeCommentNotificationPlan({
  board,
  commentAuthor,
  content,
  allUsers,
  existingComments,
  existingWatcherRecords,
}: {
  board: {
    id: string;
    title?: string | null;
    uploadedByName?: string | null;
    createdByUserId?: string | null;
  };
  commentAuthor: {
    userId?: string | null;
    name: string;
  };
  content: string;
  allUsers: TeamUserItem[];
  existingComments: MoodboardCommentLike[];
  existingWatcherRecords: WatcherRecordLike[];
}) {
  const mentionedUsers = parseMentions(content, allUsers);
  const mentionedUserIds = new Set(mentionedUsers.map((u) => u.id));

  // Determine which watcher records need to be updated/inserted:
  // - Author becomes a watcher
  // - All mentioned users become watchers
  const watcherUpdates: Array<{
    userId: string;
    isWatching: boolean;
    source: "comment" | "mention";
  }> = [];

  if (commentAuthor.userId) {
    watcherUpdates.push({
      userId: commentAuthor.userId,
      isWatching: true,
      source: "comment",
    });
  }

  for (const mUser of mentionedUsers) {
    if (mUser.id !== commentAuthor.userId) {
      watcherUpdates.push({
        userId: mUser.id,
        isWatching: true,
        source: "mention",
      });
    }
  }

  // Determine recipients of the alert
  const watchersMap = new Map<string, boolean>();
  for (const record of existingWatcherRecords) {
    watchersMap.set(record.userId, record.isWatching);
  }

  // Apply in-memory overrides for author and mentioned users
  if (commentAuthor.userId) {
    watchersMap.set(commentAuthor.userId, true);
  }
  for (const mUser of mentionedUsers) {
    watchersMap.set(mUser.id, true);
  }

  const recipients: Array<{
    user: TeamUserItem;
    isMentioned: boolean;
  }> = [];

  for (const user of allUsers) {
    // Author never receives an alert for their own comment
    if (commentAuthor.userId && user.id === commentAuthor.userId) {
      continue;
    }
    if (
      commentAuthor.name &&
      normalizeName(user.name) === normalizeName(commentAuthor.name)
    ) {
      continue;
    }

    const isMentioned = mentionedUserIds.has(user.id);

    // If mentioned, they automatically watch and receive alert
    if (isMentioned) {
      recipients.push({ user, isMentioned: true });
      continue;
    }

    // Otherwise, check if they are watching
    const explicitStatus = watchersMap.get(user.id);
    const isWatching = resolveUserWatchingState({
      userId: user.id,
      userName: user.name,
      board,
      comments: existingComments,
      explicitRecord:
        explicitStatus !== undefined ? { isWatching: explicitStatus } : null,
    });

    if (isWatching) {
      recipients.push({ user, isMentioned: false });
    }
  }

  return {
    mentionedUsers,
    watcherUpdates,
    recipients,
  };
}
