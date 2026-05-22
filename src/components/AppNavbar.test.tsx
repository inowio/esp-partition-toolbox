import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppNavbar from "./AppNavbar";

const noop = () => undefined;

describe("AppNavbar", () => {
  it("renders the app title and version", () => {
    render(
      <AppNavbar
        isDarkTheme
        appVersion="1.2.3"
        onToggleTheme={noop}
        onShowAbout={noop}
        onShowHelp={noop}
      />,
    );

    expect(screen.getByText("ESP Partition Toolbox")).toBeInTheDocument();
    expect(screen.getByText("Version 1.2.3")).toBeInTheDocument();
  });

  it("shows 'Light' label when the dark theme is active", () => {
    render(
      <AppNavbar
        isDarkTheme
        appVersion="0.1.0"
        onToggleTheme={noop}
        onShowAbout={noop}
        onShowHelp={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
  });

  it("shows 'Dark' label when the light theme is active", () => {
    render(
      <AppNavbar
        isDarkTheme={false}
        appVersion="0.1.0"
        onToggleTheme={noop}
        onShowAbout={noop}
        onShowHelp={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
  });

  it("invokes onToggleTheme when the theme button is clicked", () => {
    const onToggleTheme = vi.fn();
    render(
      <AppNavbar
        isDarkTheme
        appVersion="0.1.0"
        onToggleTheme={onToggleTheme}
        onShowAbout={noop}
        onShowHelp={noop}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it("invokes onShowAbout when the About button is clicked", () => {
    const onShowAbout = vi.fn();
    render(
      <AppNavbar
        isDarkTheme
        appVersion="0.1.0"
        onToggleTheme={noop}
        onShowAbout={onShowAbout}
        onShowHelp={noop}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "About ESP Partition Toolbox" }));
    expect(onShowAbout).toHaveBeenCalledTimes(1);
  });

  it("invokes onShowHelp when the Help button is clicked", () => {
    const onShowHelp = vi.fn();
    render(
      <AppNavbar
        isDarkTheme
        appVersion="0.1.0"
        onToggleTheme={noop}
        onShowAbout={noop}
        onShowHelp={onShowHelp}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "How to use this tool" }));
    expect(onShowHelp).toHaveBeenCalledTimes(1);
  });
});
