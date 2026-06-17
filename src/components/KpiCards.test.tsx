import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import KpiCards from "./KpiCards";

describe("KpiCards", () => {
  const flash = 4 * 1024 * 1024;
  const reserved = 0x10000;
  const usable = flash - reserved;

  it("renders total/allocated/free figures", () => {
    render(<KpiCards flashBytes={flash} allocated={usable / 2} free={usable / 2} usableBytes={usable} reservedBytes={reserved} />);
    expect(screen.getByText("Total Flash")).toBeInTheDocument();
    expect(screen.getByText("Allocated")).toBeInTheDocument();
    expect(screen.getByText("Free Space")).toBeInTheDocument();
  });

  it("computes allocated and free as a percentage of usable", () => {
    render(<KpiCards flashBytes={flash} allocated={usable / 2} free={usable / 2} usableBytes={usable} reservedBytes={reserved} />);
    // both halves of usable => 50.0% each
    expect(screen.getAllByText("50.0%").length).toBeGreaterThanOrEqual(2);
  });

  it("shows the reserved note when reservedBytes > 0", () => {
    render(<KpiCards flashBytes={flash} allocated={0} free={usable} usableBytes={usable} reservedBytes={reserved} />);
    expect(screen.getByText(/reserved for bootloader/)).toBeInTheDocument();
  });

  it("handles zero usable without dividing by zero", () => {
    render(<KpiCards flashBytes={0} allocated={0} free={0} usableBytes={0} reservedBytes={0} />);
    expect(screen.getAllByText("0.0%").length).toBeGreaterThan(0);
  });
});
