import { describe, expect, it } from "vitest";
import { MCU_OPTIONS, mcuLabel, withDetectedMcu } from "./mcuOptions";

describe("mcuOptions", () => {
  it("includes common ESP32 chips", () => {
    const ids = MCU_OPTIONS.map((m) => m.id);
    expect(ids).toContain("esp32");
    expect(ids).toContain("esp32s3");
    expect(ids).toContain("esp32c6");
  });
  it("maps ids to labels", () => {
    expect(mcuLabel("esp32s3")).toBe("ESP32-S3");
    expect(mcuLabel("esp32")).toBe("ESP32");
  });
  it("returns the raw id label for unknown chips", () => {
    expect(mcuLabel("esp32x99")).toBe("esp32x99");
  });
  it("keeps an unknown detected mcu selectable by appending it", () => {
    const opts = withDetectedMcu("esp32x99");
    expect(opts.some((o) => o.id === "esp32x99")).toBe(true);
    expect(opts.length).toBe(MCU_OPTIONS.length + 1);
  });
  it("does not duplicate a known detected mcu", () => {
    expect(withDetectedMcu("esp32s3").length).toBe(MCU_OPTIONS.length);
  });
  it("returns the base list for null", () => {
    expect(withDetectedMcu(null).length).toBe(MCU_OPTIONS.length);
  });
});
