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
    configTargets: [{ id: "C:/dev/esp/sdkconfig.defaults", label: "sdkconfig.defaults" }],
    configUpdatable: true,
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
    const picker = screen.getByTitle(/Select a config target/);
    expect(picker).toBeEnabled();
    expect(screen.getByRole("option", { name: "sdkconfig.defaults" })).toBeInTheDocument();
  });
  it("shows a bare-sketch guidance note when configUpdatable is false", () => {
    render(<TargetOutputCard {...baseProps({ configUpdatable: false })} />);
    expect(screen.getByText(/no committable config/i)).toBeInTheDocument();
  });
  it("toggles sync", () => {
    const onSyncSdkconfigChange = vi.fn();
    render(<TargetOutputCard {...baseProps({ onSyncSdkconfigChange })} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onSyncSdkconfigChange).toHaveBeenCalledWith(true);
  });
  it("shows PlatformIO env picker enabled when configUpdatable and syncSdkconfig are true", () => {
    render(<TargetOutputCard {...baseProps({
      platform: "platformio",
      configUpdatable: true,
      configTargets: [
        { id: "env:esp32s3", label: "esp32s3" },
        { id: "env:esp32c3", label: "esp32c3" },
      ],
      syncSdkconfig: true,
      sdkconfigFile: "env:esp32s3",
    })} />);
    const picker = screen.getByTitle(/Select a config target/);
    expect(picker).toBeEnabled();
    expect(screen.getByRole("option", { name: "esp32s3" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "esp32c3" })).toBeInTheDocument();
  });
  it("shows bare-sketch guidance note for Arduino (configUpdatable false)", () => {
    render(<TargetOutputCard {...baseProps({
      platform: "arduino",
      configUpdatable: false,
    })} />);
    expect(screen.getByText(/no committable config/i)).toBeInTheDocument();
    expect(screen.getByText(/Partition Scheme/i)).toBeInTheDocument();
    expect(screen.queryByTitle(/Select a config target/)).not.toBeInTheDocument();
  });
});
