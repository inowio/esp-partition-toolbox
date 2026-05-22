import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import VisualMapCard from "./VisualMapCard";
import type { PartitionLayoutRow } from "../types";

function makeLayoutRow(overrides: Partial<PartitionLayoutRow>): PartitionLayoutRow {
  return {
    id: "row-1",
    name: "part",
    type: "data",
    subtype: "nvs",
    size: "64K",
    pinnedOffset: "",
    encrypted: false,
    readonly: false,
    offset: 0x10000,
    end: 0x20000,
    sizeBytes: 0x10000,
    flags: "",
    ...overrides,
  };
}

describe("VisualMapCard", () => {
  it("shows the empty placeholder when there are no partitions", () => {
    render(<VisualMapCard rows={[]} flashBytes={2 * 1024 * 1024} reservedBytes={0} />);
    expect(screen.getByText("No partitions to visualize")).toBeInTheDocument();
  });

  it("renders the heading", () => {
    render(<VisualMapCard rows={[]} flashBytes={2 * 1024 * 1024} reservedBytes={0} />);
    expect(screen.getByText("Partition Visual Map")).toBeInTheDocument();
  });

  it("renders a legend entry for each partition", () => {
    const rows = [
      makeLayoutRow({ id: "r1", name: "nvs", offset: 0x10000, end: 0x14000, sizeBytes: 0x4000 }),
      makeLayoutRow({
        id: "r2",
        name: "factory",
        type: "app",
        subtype: "factory",
        size: "1M",
        offset: 0x20000,
        end: 0x120000,
        sizeBytes: 0x100000,
      }),
    ];
    render(<VisualMapCard rows={rows} flashBytes={2 * 1024 * 1024} reservedBytes={0x10000} />);

    expect(screen.getAllByText("nvs").length).toBeGreaterThan(0);
    expect(screen.getAllByText("factory").length).toBeGreaterThan(0);
  });

  it("renders a reserved segment when the first partition has a non-zero offset", () => {
    const rows = [makeLayoutRow({ offset: 0x10000, end: 0x110000, sizeBytes: 0x100000 })];
    render(<VisualMapCard rows={rows} flashBytes={2 * 1024 * 1024} reservedBytes={0x10000} />);

    expect(screen.getByTitle(/Reserved \(bootloader/)).toBeInTheDocument();
  });
});
