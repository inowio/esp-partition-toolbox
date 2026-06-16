import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TargetOutputCard from "./TargetOutputCard";

type Props = Parameters<typeof TargetOutputCard>[0];
function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    platform: "esp-idf",
    mcu: "esp32s3",
    flashSizeMb: 8,
    flashOptions: [2, 4, 8, 16],
    partitionFilename: "partitions.csv",
    projectPath: "C:/dev/esp",
    syncSdkconfig: false,
    sdkconfigFile: "C:/dev/esp/sdkconfig.defaults",
    sdkconfigFiles: ["C:/dev/esp/sdkconfig.defaults"],
    isBusy: false,
    onPlatformChange: () => undefined,
    onMcuChange: () => undefined,
    onFlashSizeChange: () => undefined,
    onSyncSdkconfigChange: () => undefined,
    onSdkconfigFileChange: () => undefined,
    ...overrides,
  };
}

describe("TargetOutputCard", () => {
  it("renders platform, mcu and flash selects", () => {
    render(<TargetOutputCard {...baseProps()} />);
    expect(screen.getByTitle("Select platform")).toHaveValue("esp-idf");
    expect(screen.getByTitle("Select target chip (informational)")).toHaveValue("esp32s3");
    expect(screen.getByTitle("Select flash size")).toHaveValue("8");
  });
  it("fires platform/mcu/flash changes", () => {
    const onPlatformChange = vi.fn(), onMcuChange = vi.fn(), onFlashSizeChange = vi.fn();
    render(<TargetOutputCard {...baseProps({ onPlatformChange, onMcuChange, onFlashSizeChange })} />);
    fireEvent.change(screen.getByTitle("Select platform"), { target: { value: "platformio" } });
    expect(onPlatformChange).toHaveBeenCalledWith("platformio");
    fireEvent.change(screen.getByTitle("Select target chip (informational)"), { target: { value: "esp32c6" } });
    expect(onMcuChange).toHaveBeenCalledWith("esp32c6");
    fireEvent.change(screen.getByTitle("Select flash size"), { target: { value: "16" } });
    expect(onFlashSizeChange).toHaveBeenCalledWith(16);
  });
  it("shows the sdkconfig file picker for ESP-IDF when sync is on", () => {
    render(<TargetOutputCard {...baseProps({ syncSdkconfig: true })} />);
    expect(screen.getByTitle(/Select a config target/)).toBeEnabled();
  });
  it("shows an 'available soon' note when forcing an unsupported platform", () => {
    render(<TargetOutputCard {...baseProps({ platform: "platformio" })} />);
    expect(screen.getByText(/available in a later update/i)).toBeInTheDocument();
  });
  it("toggles sync", () => {
    const onSyncSdkconfigChange = vi.fn();
    render(<TargetOutputCard {...baseProps({ onSyncSdkconfigChange })} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onSyncSdkconfigChange).toHaveBeenCalledWith(true);
  });
});
