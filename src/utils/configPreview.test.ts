import { describe, expect, it } from "vitest";
import { buildConfigPreview } from "./configPreview";

describe("buildConfigPreview", () => {
  it("renders the ESP-IDF sdkconfig block", () => {
    const out = buildConfigPreview("esp-idf", { partitionFilename: "partitions.csv", partitionOffset: "0x8000" });
    expect(out).toContain("CONFIG_PARTITION_TABLE_CUSTOM=y");
    expect(out).toContain('CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="partitions.csv"');
    expect(out).toContain("CONFIG_PARTITION_TABLE_OFFSET=0x8000");
  });
  it("renders the PlatformIO board_build.partitions snippet", () => {
    const out = buildConfigPreview("platformio", { partitionFilename: "custom.csv", partitionOffset: "0x8000" });
    expect(out).toContain("board_build.partitions = custom.csv");
    expect(out.toLowerCase()).toContain("[env:");
  });
  it("renders the Arduino guidance", () => {
    const out = buildConfigPreview("arduino", { partitionFilename: "partitions.csv", partitionOffset: "0x8000" });
    expect(out.toLowerCase()).toContain("partitions.csv");
    expect(out.toLowerCase()).toContain("partition scheme");
  });
  it("escapes a quote in the filename for ESP-IDF", () => {
    const out = buildConfigPreview("esp-idf", { partitionFilename: 'we"ird.csv', partitionOffset: "0x8000" });
    expect(out).toContain('\\"');
  });
});
