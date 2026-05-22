import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CloseProjectModal from "./CloseProjectModal";

describe("CloseProjectModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <CloseProjectModal open={false} onCancel={() => undefined} onConfirm={() => undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the confirmation prompt when open", () => {
    render(<CloseProjectModal open onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(screen.getByText("Close project?")).toBeInTheDocument();
  });

  it("invokes onConfirm when 'Okay' is clicked", () => {
    const onConfirm = vi.fn();
    render(<CloseProjectModal open onCancel={() => undefined} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Okay" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("invokes onCancel when 'Cancel' is clicked", () => {
    const onCancel = vi.fn();
    render(<CloseProjectModal open onCancel={onCancel} onConfirm={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("invokes onCancel when the backdrop is clicked", () => {
    const onCancel = vi.fn();
    render(<CloseProjectModal open onCancel={onCancel} onConfirm={() => undefined} />);

    // The backdrop is the outermost element wrapping the dialog.
    fireEvent.click(screen.getByText("Close project?").parentElement!.parentElement!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not invoke onCancel when the dialog body is clicked", () => {
    const onCancel = vi.fn();
    render(<CloseProjectModal open onCancel={onCancel} onConfirm={() => undefined} />);

    fireEvent.click(screen.getByText("Close project?"));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
