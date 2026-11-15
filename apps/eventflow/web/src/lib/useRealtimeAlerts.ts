"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AlertItem } from "@/components/AlertsDrawerModal";

export type { AlertItem };

interface UseRealtimeAlertsOptions {
  initialAlerts?: AlertItem[];
  currentUser?: { id: string; name?: string } | null;
  pollIntervalMs?: number;
  onNewAlert?: (alert: AlertItem) => void;
  isLoggingOut?: boolean;
}

const ALERTS_BROADCAST_CHANNEL = "cfm_realtime_alerts_channel";

export function broadcastAlertUpdate() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("eventflow:refresh-alerts"));
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(ALERTS_BROADCAST_CHANNEL);
      channel.postMessage({ type: "ALERTS_UPDATED", timestamp: Date.now() });
      channel.close();
    }
    localStorage.setItem("cfm_alerts_ping", Date.now().toString());
  } catch {}
}

export function useRealtimeAlerts({
  initialAlerts = [],
  currentUser,
  pollIntervalMs = 3500,
  onNewAlert,
  isLoggingOut = false,
}: UseRealtimeAlertsOptions) {
  const [alertsList, setAlertsList] = useState<AlertItem[]>(initialAlerts);
  const knownAlertIdsRef = useRef<Set<string>>(
    new Set(initialAlerts.map((a) => a.id))
  );
  const isFetchingRef = useRef(false);
  const isLoggingOutRef = useRef(isLoggingOut);

  useEffect(() => {
    isLoggingOutRef.current = isLoggingOut;
  }, [isLoggingOut]);

  useEffect(() => {
    if (initialAlerts && initialAlerts.length > 0) {
      setAlertsList((prev) => {
        if (prev.length === 0) return initialAlerts;
        return prev;
      });
      for (const a of initialAlerts) {
        knownAlertIdsRef.current.add(a.id);
      }
    }
  }, [initialAlerts]);

  const fetchAlerts = useCallback(async () => {
    if (isLoggingOutRef.current || !currentUser?.id) return;
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    try {
      const res = await fetch("/api/alerts", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.alerts)) {
        const freshAlerts = data.alerts as AlertItem[];

        // Check for newly arrived unacknowledged active alerts
        for (const alert of freshAlerts) {
          if (!knownAlertIdsRef.current.has(alert.id)) {
            knownAlertIdsRef.current.add(alert.id);
            const isTargetedToUser = !alert.userId || alert.userId === currentUser.id;
            if (isTargetedToUser && !alert.acknowledgedAt && alert.status === "active") {
              onNewAlert?.(alert);
            }
          }
        }

        setAlertsList(freshAlerts);
      }
    } catch {
      // Network offline, skip
    } finally {
      isFetchingRef.current = false;
    }
  }, [currentUser?.id, onNewAlert]);

  useEffect(() => {
    if (!currentUser?.id || isLoggingOut) return;

    fetchAlerts();

    const interval = setInterval(fetchAlerts, pollIntervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchAlerts();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    const handleLocalRefresh = () => {
      fetchAlerts();
    };
    window.addEventListener("eventflow:refresh-alerts", handleLocalRefresh);

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(ALERTS_BROADCAST_CHANNEL);
      channel.onmessage = (event) => {
        if (event.data?.type === "ALERTS_UPDATED") {
          fetchAlerts();
        }
      };
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "cfm_alerts_ping") {
        fetchAlerts();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
      window.removeEventListener("eventflow:refresh-alerts", handleLocalRefresh);
      window.removeEventListener("storage", handleStorage);
      if (channel) {
        channel.close();
      }
    };
  }, [currentUser?.id, isLoggingOut, pollIntervalMs, fetchAlerts]);

  return {
    alertsList,
    setAlertsList,
    refreshAlerts: fetchAlerts,
    broadcastAlertUpdate,
  };
}
