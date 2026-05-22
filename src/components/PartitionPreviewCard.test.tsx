import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PartitionPreviewCard from "./PartitionPreviewCard";

const SAMPLE_CSV = "# Name, Type, SubType, Offset, Size, Flags\nnvs, data, nvs, 0x10000, 16K,";

describe("PartitionPreviewCard", () => {
  it("renders the CSV inside a read-only textarea", () => {
    render(<PartitionPreviewCard csv={SAMPLE_CSV} onCopy={() => undefined} isBusy={false} />);

    const textarea = screen.getByRole("textbox", { name: "Partition CSV preview" });
    expect(textarea).toHaveValue(SAMPLE_CSV);
    expect(textarea).toHaveAttribute("readonly");
  });

  it("shows the card heading", () => {
    render(<PartitionPreviewCard csv={SAMPLE_CSV} onCopy={() => undefined} isBusy={false} />);
    expect(screen.getByRole("heading", { name: "Partition Preview" })).toBeInTheDocument();
  });

  it("invokes onCopy when the copy button is clicked", () => {
    const onCopy = vi.fn();
    render(<PartitionPreviewCard csv={SAMPLE_CSV} onCopy={onCopy} isBusy={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("disables the copy button while busy", () => {
    render(<PartitionPreviewCard csv={SAMPLE_CSV} onCopy={() => undefined} isBusy />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeDisabled();
  });
});
