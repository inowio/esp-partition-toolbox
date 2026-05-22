import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const checkForUpdateMock = vi.fn();

vi.mock("../api/updater", () => ({
  checkForUpdate: (...args: unknown[]) => checkForUpdateMock(...args),
}));

vi.mock("../api/openExternal", () => ({
  openExternal: vi.fn(),
}));

import AboutModal from "./AboutModal";

function renderModal(overrides: Partial<Parameters<typeof AboutModal>[0]> = {}) {
  const props = {
    open: true,
    appVersion: "0.1.0",
    onClose: vi.fn(),
    onUpdateAvailable: vi.fn(),
    ...overrides,
  };
  render(<AboutModal {...props} />);
  return props;
}

describe("AboutModal", () => {
  beforeEach(() => {
    checkForUpdateMock.mockReset();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <AboutModal
        open={false}
        appVersion="0.1.0"
        onClose={vi.fn()}
        onUpdateAvailable={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the app version and company information when open", () => {
    renderModal({ appVersion: "1.2.3" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("v1.2.3")).toBeInTheDocument();
    expect(screen.getByText("Inowio Technologies LLP")).toBeInTheDocument();
  });

  it("invokes onClose when the close button is clicked", () => {
    const props = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when the backdrop is clicked", () => {
    const props = renderModal();
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("reports when the app is already up to date", async () => {
    checkForUpdateMock.mockResolvedValueOnce({ status: "up-to-date" });
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /Check for updates/ }));
    await waitFor(() => {
      expect(screen.getByText("You're on the latest version.")).toBeInTheDocument();
    });
  });

  it("hands a found update up to the parent", async () => {
    const update = { version: "9.9.9" };
    checkForUpdateMock.mockResolvedValueOnce({
      status: "available",
      version: "9.9.9",
      currentVersion: "0.1.0",
      notes: "New stuff",
      update,
    });
    const props = renderModal();

    fireEvent.click(screen.getByRole("button", { name: /Check for updates/ }));
    await waitFor(() => {
      expect(props.onUpdateAvailable).toHaveBeenCalledWith({
        version: "9.9.9",
        currentVersion: "0.1.0",
        notes: "New stuff",
        update,
      });
    });
  });

  it("shows an error when the update check fails", async () => {
    checkForUpdateMock.mockResolvedValueOnce({ status: "error", message: "offline" });
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /Check for updates/ }));
    await waitFor(() => {
      expect(screen.getByText("Could not check for updates.")).toBeInTheDocument();
    });
  });
});
