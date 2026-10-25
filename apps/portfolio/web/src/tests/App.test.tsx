import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "@/App";

describe("App Component", () => {
  it("renders portfolio hero with João Noronha and editorial headline", () => {
    render(<App />);
    expect(screen.getAllByText(/João/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Engineering leader building/i)).toBeInTheDocument();
  });

  it("renders key stats including 9 direct reports", () => {
    render(<App />);
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("Direct reports")).toBeInTheDocument();
  });

  it("renders experience timeline with Dialpad, Hugo Boss, and AT&T", () => {
    render(<App />);
    expect(screen.getAllByText(/Dialpad/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/@Hugo Boss/i)).toBeInTheDocument();
    expect(screen.getByText(/@AT&T/i)).toBeInTheDocument();
  });

  it("switches to standalone AI focus view when How I Build with AI is clicked", () => {
    render(<App />);
    const aiButtons = screen.getAllByRole("button", { name: /How I Build with AI/i });
    fireEvent.click(aiButtons[0]);

    expect(screen.getByRole("button", { name: /Back to main portfolio/i })).toBeInTheDocument();
  });
});
