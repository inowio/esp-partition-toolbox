import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DeletePartitionModal from "./DeletePartitionModal";
import type { PartitionDraftRow } from "../types";

const SAMPLE_ROW: PartitionDraftRow = {
  id: "row-1",
  name: "factory",
  type: "app",
  subtype: "factory",
  size: "1M",
  encrypted: false,
};

describe("DeletePartitionModal", () => {
  it("renders nothing when no row is pending deletion", () => {
    const { container } = render(
      <DeletePartitionModal row={null} onCancel={() => undefined} onConfirm={() => undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the pending partition name", () => {
    render(<DeletePartitionModal row={SAMPLE_ROW} onCancel={() => undefined} onConfirm={() => undefined} />);

    expect(screen.getByText("Delete partition?")).toBeInTheDocument();
    expect(screen.getByText("factory")).toBeInTheDocument();
  });

  it("invokes onConfirm when 'Delete' is clicked", () => {
    const onConfirm = vi.fn();
    render(<DeletePartitionModal row={SAMPLE_ROW} onCancel={() => undefined} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("invokes onCancel when 'Cancel' is clicked", () => {
    const onCancel = vi.fn();
    render(<DeletePartitionModal row={SAMPLE_ROW} onCancel={onCancel} onConfirm={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("invokes onCancel when the backdrop is clicked", () => {
    const onCancel = vi.fn();
    render(<DeletePartitionModal row={SAMPLE_ROW} onCancel={onCancel} onConfirm={() => undefined} />);

    fireEvent.click(screen.getByText("Delete partition?").parentElement!.parentElement!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
