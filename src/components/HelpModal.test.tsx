import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HelpModal from "./HelpModal";

describe("HelpModal", () => {
  it("renders nothing when closed", () => {
    render(<HelpModal open={false} onClose={() => undefined} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens on the Getting Started tab", () => {
    render(<HelpModal open onClose={() => undefined} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("1. Load your project")).toBeInTheDocument();
    expect(screen.getByText("6. Save or export")).toBeInTheDocument();
  });

  it("switches to the Platforms tab and shows PlatformIO content", () => {
    render(<HelpModal open onClose={() => undefined} />);
    fireEvent.click(screen.getByRole("tab", { name: "Platforms" }));
    expect(screen.getByText("PlatformIO")).toBeInTheDocument();
    expect(screen.getByText(/board_build\.partitions/)).toBeInTheDocument();
    expect(screen.getByText("ESP-IDF")).toBeInTheDocument();
    expect(screen.getByText("Arduino")).toBeInTheDocument();
  });

  it("switches to the Partition Types tab", () => {
    render(<HelpModal open onClose={() => undefined} />);
    fireEvent.click(screen.getByRole("tab", { name: "Partition Types" }));
    expect(screen.getByText("App partitions (type: app)")).toBeInTheDocument();
    expect(screen.getByText("Data partitions (type: data)")).toBeInTheDocument();
  });

  it("switches to the Flags & Encryption tab and covers both flags", () => {
    render(<HelpModal open onClose={() => undefined} />);
    fireEvent.click(screen.getByRole("tab", { name: "Flags & Encryption" }));
    expect(screen.getByText("What flash encryption is")).toBeInTheDocument();
    expect(screen.getByText("The Read-only flag")).toBeInTheDocument();
  });

  it("switches to the Key Concepts tab and documents Advanced mode", () => {
    render(<HelpModal open onClose={() => undefined} />);
    fireEvent.click(screen.getByRole("tab", { name: "Key Concepts" }));
    expect(screen.getByText("Offset & alignment")).toBeInTheDocument();
    expect(screen.getByText("Advanced mode")).toBeInTheDocument();
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
