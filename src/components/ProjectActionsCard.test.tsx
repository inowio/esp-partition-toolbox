import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectActionsCard from "./ProjectActionsCard";

type Props = Parameters<typeof ProjectActionsCard>[0];
function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    projectPath: "",
    platform: "esp-idf",
    statusMessage: "Select an ESP-IDF project folder to begin.",
    isBusy: false,
    onLoad: () => undefined,
    onSave: () => undefined,
    onClose: () => undefined,
    onReset: () => undefined,
    ...overrides,
  };
}

describe("ProjectActionsCard", () => {
  it("shows the empty prompt with no project", () => {
    render(<ProjectActionsCard {...baseProps()} />);
    expect(screen.getByText(/No project/i)).toBeInTheDocument();
  });
  it("shows the path and platform badge when loaded", () => {
    render(<ProjectActionsCard {...baseProps({ projectPath: "C:/dev/esp", platform: "esp-idf" })} />);
    expect(screen.getByText("C:/dev/esp")).toBeInTheDocument();
    expect(screen.getByText("ESP-IDF")).toBeInTheDocument();
  });
  it("disables Save/Close without a project, enables Load", () => {
    render(<ProjectActionsCard {...baseProps()} />);
    expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Close/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Load Project/ })).toBeEnabled();
  });
  it("disables the Load Project and Reset buttons while busy", () => {
    render(<ProjectActionsCard {...baseProps({ projectPath: "C:/dev/esp", isBusy: true })} />);
    expect(screen.getByRole("button", { name: /Load Project/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Reset/ })).toBeDisabled();
  });
  it("fires action callbacks", () => {
    const onLoad = vi.fn(), onSave = vi.fn(), onClose = vi.fn(), onReset = vi.fn();
    render(<ProjectActionsCard {...baseProps({ projectPath: "C:/dev/esp", onLoad, onSave, onClose, onReset })} />);
    fireEvent.click(screen.getByRole("button", { name: /Load Project/ })); expect(onLoad).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Save/ })); expect(onSave).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Close/ })); expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Reset/ })); expect(onReset).toHaveBeenCalled();
  });
});
