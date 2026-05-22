import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HelpModal from "./HelpModal";

describe("HelpModal", () => {
  it("renders nothing when closed", () => {
    render(<HelpModal open={false} onClose={() => undefined} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the step-by-step guide when open", () => {
    render(<HelpModal open onClose={() => undefined} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("1. Load your ESP-IDF project")).toBeInTheDocument();
    expect(screen.getByText("6. Save or copy the result")).toBeInTheDocument();
  });

  it("invokes onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<HelpModal open onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<HelpModal open onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
