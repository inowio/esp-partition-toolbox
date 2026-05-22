import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PartitionInformationCard from "./PartitionInformationCard";

const SAMPLE_INFO = "CONFIG_PARTITION_TABLE_CUSTOM=y";

describe("PartitionInformationCard", () => {
  it("renders the partition info inside a read-only textarea", () => {
    render(<PartitionInformationCard partitionInfo={SAMPLE_INFO} onCopy={() => undefined} isBusy={false} />);

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue(SAMPLE_INFO);
    expect(textarea).toHaveAttribute("readonly");
  });

  it("invokes onCopy when the copy button is clicked", () => {
    const onCopy = vi.fn();
    render(<PartitionInformationCard partitionInfo={SAMPLE_INFO} onCopy={onCopy} isBusy={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("disables the copy button while busy", () => {
    render(<PartitionInformationCard partitionInfo={SAMPLE_INFO} onCopy={() => undefined} isBusy />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeDisabled();
  });
});
