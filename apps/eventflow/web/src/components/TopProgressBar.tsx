"use client";

import React, { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";

export default function TopProgressBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentPathRef = useRef(pathname);

  // Complete progress bar when route finishes changing
  useEffect(() => {
    if (currentPathRef.current !== pathname) {
      currentPathRef.current = pathname;
      if (timerRef.current) clearInterval(timerRef.current);
      // Finish progress bar
      setProgress(100);
      const hideTimeout = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 200);
      return () => clearTimeout(hideTimeout);
    }
  }, [pathname]);

  // Intercept click on links to show immediate progress
  useEffect(() => {
    const startProgress = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setVisible(true);
      setProgress(25);

      timerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 90;
          }
          const increment = Math.max(1, (90 - prev) * 0.15);
          return Math.min(90, prev + increment);
        });
      }, 100);

      // Failsafe auto-reset: never stay stuck if route transition is fast, aborted or cached
      setTimeout(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        setVisible(false);
        setProgress(0);
      }, 3500);
    };

    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const targetAttr = anchor.getAttribute("target");

      // Skip external links, hash anchors, mailto, etc.
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        targetAttr === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      // Check if target is a different route
      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin === window.location.origin) {
          if (url.pathname !== window.location.pathname || url.search !== window.location.search) {
            startProgress();
          }
        }
      } catch {
        // invalid URL
      }
    };

    // Custom events so any action can trigger the loading bar
    const handleCustomStart = () => startProgress();
    const handleCustomStop = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 200);
    };

    document.addEventListener("click", handleAnchorClick, true);
    window.addEventListener("start-page-progress", handleCustomStart);
    window.addEventListener("stop-page-progress", handleCustomStop);

    return () => {
      document.removeEventListener("click", handleAnchorClick, true);
      window.removeEventListener("start-page-progress", handleCustomStart);
      window.removeEventListener("stop-page-progress", handleCustomStop);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-[2.5px] overflow-hidden"
    >
      <div
        className="h-full bg-gradient-to-r from-[#007aff] via-[#5856d6] to-[#007aff] transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? "180ms" : "250ms",
          boxShadow: "0 0 10px rgba(0, 122, 255, 0.7), 0 0 4px rgba(88, 86, 214, 0.5)",
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}
