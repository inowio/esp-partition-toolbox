import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import KpiCards from "./KpiCards";

describe("KpiCards", () => {
  it("renders total / allocated / free space figures", () => {
    render(
      <KpiCards
        flashBytes={2 * 1024 * 1024}
        allocated={1 * 1024 * 1024}
        free={1 * 1024 * 1024}
        reservedBytes={0}
      />,
    );

    expect(screen.getByText("Total Flash")).toBeInTheDocument();
    expect(screen.getByText("Allocated")).toBeInTheDocument();
    expect(screen.getByText("Free Space")).toBeInTheDocument();
    // flashBytes and free are both 2MB / 1MB respectively.
    expect(screen.getAllByText("1.00 MB").length).toBeGreaterThan(0);
    expect(screen.getByText("2.00 MB")).toBeInTheDocument();
  });

  it("computes the used percentage from flash and free space", () => {
    render(
      <KpiCards
        flashBytes={4 * 1024 * 1024}
        allocated={3 * 1024 * 1024}
        free={1 * 1024 * 1024}
        reservedBytes={0}
      />,
    );
    // (4MB - 1MB) / 4MB = 75.0%
    expect(screen.getAllByText("75.0%").length).toBeGreaterThan(0);
  });

  it("shows the reserved-space note only when reservedBytes is positive", () => {
    const { rerender } = render(
      <KpiCards flashBytes={2 * 1024 * 1024} allocated={0} free={2 * 1024 * 1024} reservedBytes={0} />,
    );
    expect(screen.queryByText(/reserved for bootloader/)).not.toBeInTheDocument();

    rerender(
      <KpiCards
        flashBytes={2 * 1024 * 1024}
        allocated={0}
        free={2 * 1024 * 1024 - 0x10000}
        reservedBytes={0x10000}
      />,
    );
    expect(screen.getByText(/reserved for bootloader/)).toBeInTheDocument();
  });

  it("reports 0% used when flash size is zero", () => {
    render(<KpiCards flashBytes={0} allocated={0} free={0} reservedBytes={0} />);
    expect(screen.getAllByText("0.0%").length).toBeGreaterThan(0);
  });
});
