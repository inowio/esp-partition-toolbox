import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppNavbar from "./AppNavbar";

describe("AppNavbar", () => {
  it("renders the app title and version", () => {
    render(<AppNavbar isDarkTheme appVersion="1.2.3" onToggleTheme={() => undefined} />);

    expect(screen.getByText("ESP Partition Toolbox")).toBeInTheDocument();
    expect(screen.getByText("Version 1.2.3")).toBeInTheDocument();
  });

  it("shows 'Light' label when the dark theme is active", () => {
    render(<AppNavbar isDarkTheme appVersion="0.1.0" onToggleTheme={() => undefined} />);
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
  });

  it("shows 'Dark' label when the light theme is active", () => {
    render(<AppNavbar isDarkTheme={false} appVersion="0.1.0" onToggleTheme={() => undefined} />);
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
  });

  it("invokes onToggleTheme when the theme button is clicked", () => {
    const onToggleTheme = vi.fn();
    render(<AppNavbar isDarkTheme appVersion="0.1.0" onToggleTheme={onToggleTheme} />);

    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });
});
