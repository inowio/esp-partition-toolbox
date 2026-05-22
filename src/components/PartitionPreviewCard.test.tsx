import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PartitionPreviewCard from "./PartitionPreviewCard";

const SAMPLE_CSV = "# Name, Type, SubType, Offset, Size, Flags\nnvs, data, nvs, 0x10000, 16K,";

describe("PartitionPreviewCard", () => {
  it("renders the CSV inside a read-only textarea", () => {
    render(<PartitionPreviewCard csv={SAMPLE_CSV} />);

    const textarea = screen.getByRole("textbox", { name: "Partition CSV preview" });
    expect(textarea).toHaveValue(SAMPLE_CSV);
    expect(textarea).toHaveAttribute("readonly");
  });

  it("shows the card heading", () => {
    render(<PartitionPreviewCard csv={SAMPLE_CSV} />);
    expect(screen.getByRole("heading", { name: "Partition Preview" })).toBeInTheDocument();
  });
});
