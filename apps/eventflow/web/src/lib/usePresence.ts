"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface OnlineUser {
  userId: string;
  userName: string;
  userEmail: string | null;
  userRole: string | null;
  avatarUrl: string | null;
  editingEntityType: "event" | "inventory" | null;
  editingEntityId: string | null;
  editingEntityTitle: string | null;
  lastSeenAt: string | Date;
  isOnline: boolean;
}

export interface UsePresenceOptions {
  currentUser?: {
    id: string;
    name: string;
    email?: string;
    role?: string;
    avatarUrl?: string | null;
  } | null;
  editing?: {
    type: "event" | "inventory";
    id: string;
    title?: string;
  } | null;
  pollIntervalMs?: number;
}

export function usePresence(options: UsePresenceOptions = {}) {
  const { currentUser, editing, pollIntervalMs = 10000 } = options;
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const currentUserRef = useRef(currentUser);
  const editingRef = useRef(editing);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  const sendHeartbeat = useCallback(async () => {
    const user = currentUserRef.current;
    if (!user || !user.id) {
      // Just fetch online users
      try {
        const res = await fetch("/api/presence", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.onlineUsers)) {
            setOnlineUsers(data.onlineUsers);
          }
        }
      } catch {
        // Network offline
      }
      return;
    }

    try {
      const payload = {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        avatarUrl: user.avatarUrl,
        editing: editingRef.current || null,
        action: "ping",
      };

      const res = await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.onlineUsers)) {
          setOnlineUsers(data.onlineUsers);
        }
      }
    } catch {
      // Network offline
    }
  }, []);

  useEffect(() => {
    // Initial heartbeat
    sendHeartbeat();

    // Periodic heartbeat interval
    const interval = setInterval(sendHeartbeat, pollIntervalMs);

    // On page visibility change (when tab is focused again, ping immediately)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Offline on page unload
    const handleBeforeUnload = () => {
      const user = currentUserRef.current;
      if (user && user.id) {
        const payload = JSON.stringify({
          userId: user.id,
          userName: user.name,
          action: "offline",
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/presence", new Blob([payload], { type: "application/json" }));
        } else {
          fetch("/api/presence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      // Also mark offline when leaving editing or unmounting user presence hook if on this page
      const user = currentUserRef.current;
      if (user && user.id && editingRef.current) {
        // Update presence to clear editing state
        fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            userName: user.name,
            editing: null,
            action: "ping",
          }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [sendHeartbeat, pollIntervalMs]);

  // Find other users currently editing the active entity
  const activeEditors = onlineUsers.filter((u) => {
    if (currentUser?.id && u.userId === currentUser.id) return false;
    if (!editing?.type || !editing?.id) return false;
    return u.editingEntityType === editing.type && u.editingEntityId === editing.id;
  });

  return {
    onlineUsers,
    activeEditors,
    refreshPresence: sendHeartbeat,
  };
}
