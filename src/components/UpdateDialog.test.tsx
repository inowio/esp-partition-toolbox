import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UpdateDialog from "./UpdateDialog";

function renderDialog(overrides: Partial<Parameters<typeof UpdateDialog>[0]> = {}) {
  const props = {
    open: true,
    version: "0.2.0",
    currentVersion: "0.1.0",
    notes: "Fixed a bug",
    install: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<UpdateDialog {...props} />);
  return props;
}

describe("UpdateDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <UpdateDialog
        open={false}
        version="0.2.0"
        currentVersion="0.1.0"
        notes={null}
        install={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the available and current versions when open", () => {
    renderDialog();
    expect(screen.getByText("Update available")).toBeInTheDocument();
    expect(
      screen.getByText("Version 0.2.0 is available. You have 0.1.0."),
    ).toBeInTheDocument();
  });

  it("renders release notes when provided", () => {
    renderDialog({ notes: "Fixed a bug" });
    expect(screen.getByText("Fixed a bug")).toBeInTheDocument();
  });

  it("shows a fallback when no release notes are provided", () => {
    renderDialog({ notes: null });
    expect(screen.getByText("No release notes provided.")).toBeInTheDocument();
  });

  it("invokes onClose when 'Later' is clicked", () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when the close button is clicked", () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes install when 'Install' is clicked", () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(props.install).toHaveBeenCalledTimes(1);
  });

  it("surfaces an error and offers a retry when install fails", async () => {
    const install = vi.fn().mockRejectedValue(new Error("boom"));
    renderDialog({ install });
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    await waitFor(() => {
      expect(screen.getByText(/Update failed: boom/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
