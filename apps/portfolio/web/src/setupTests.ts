import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock jsdom window.scrollTo
if (typeof window !== "undefined") {
  window.scrollTo = vi.fn();
}
