import { describe, expect, it } from "vitest";
import {
  PARTITION_TYPE_OPTIONS,
  getSubtypeOptionsForType,
  getDefaultSubtypeForType,
  withCurrentOption,
} from "./partitionOptions";

describe("PARTITION_TYPE_OPTIONS", () => {
  it("contains only app and data", () => {
    expect([...PARTITION_TYPE_OPTIONS]).toEqual(["app", "data"]);
  });

  it("does not contain bootloader or partition_table", () => {
    expect(PARTITION_TYPE_OPTIONS).not.toContain("bootloader");
    expect(PARTITION_TYPE_OPTIONS).not.toContain("partition_table");
  });
});

describe("getSubtypeOptionsForType", () => {
  it("returns app subtypes for 'app'", () => {
    const subtypes = getSubtypeOptionsForType("app");
    expect(subtypes).toContain("factory");
    expect(subtypes).toContain("test");
    expect(subtypes).toContain("ota_0");
    expect(subtypes).toContain("ota_15");
  });

  it("returns exactly 18 app subtypes (factory + ota_0..ota_15 + test)", () => {
    const subtypes = getSubtypeOptionsForType("app");
    expect(subtypes).toHaveLength(18);
  });

  it("returns data subtypes for 'data'", () => {
    const subtypes = getSubtypeOptionsForType("data");
    expect(subtypes).toContain("ota");
    expect(subtypes).toContain("phy");
    expect(subtypes).toContain("nvs");
    expect(subtypes).toContain("coredump");
    expect(subtypes).toContain("nvs_keys");
    expect(subtypes).toContain("efuse");
    expect(subtypes).toContain("undefined");
    expect(subtypes).toContain("esphttpd");
    expect(subtypes).toContain("fat");
    expect(subtypes).toContain("spiffs");
    expect(subtypes).toContain("littlefs");
  });

  it("returns exactly 11 data subtypes", () => {
    const subtypes = getSubtypeOptionsForType("data");
    expect(subtypes).toHaveLength(11);
  });

  it("is case-insensitive", () => {
    expect(getSubtypeOptionsForType("APP")).toEqual(getSubtypeOptionsForType("app"));
    expect(getSubtypeOptionsForType("Data")).toEqual(getSubtypeOptionsForType("data"));
  });

  it("trims whitespace", () => {
    expect(getSubtypeOptionsForType("  app  ")).toEqual(getSubtypeOptionsForType("app"));
  });

  it("returns empty array for unknown type", () => {
    expect(getSubtypeOptionsForType("unknown")).toEqual([]);
    expect(getSubtypeOptionsForType("")).toEqual([]);
  });
});

describe("getDefaultSubtypeForType", () => {
  it("returns 'factory' as default app subtype", () => {
    expect(getDefaultSubtypeForType("app")).toBe("factory");
  });

  it("returns 'ota' as default data subtype", () => {
    expect(getDefaultSubtypeForType("data")).toBe("ota");
  });

  it("returns empty string for unknown type", () => {
    expect(getDefaultSubtypeForType("unknown")).toBe("");
    expect(getDefaultSubtypeForType("")).toBe("");
  });

  it("is case-insensitive", () => {
    expect(getDefaultSubtypeForType("APP")).toBe("factory");
    expect(getDefaultSubtypeForType("DATA")).toBe("ota");
  });
});

describe("withCurrentOption", () => {
  const dataSubtypes = getSubtypeOptionsForType("data");

  it("returns options unchanged when current value is in the list", () => {
    const result = withCurrentOption(dataSubtypes, "nvs");
    expect(result).toEqual([...dataSubtypes]);
  });

  it("appends current value when it is not in the list", () => {
    const result = withCurrentOption(dataSubtypes, "custom_subtype");
    expect(result).toContain("custom_subtype");
    expect(result).toHaveLength(dataSubtypes.length + 1);
    expect(result[result.length - 1]).toBe("custom_subtype");
  });

  it("returns options unchanged when current value is empty", () => {
    const result = withCurrentOption(dataSubtypes, "");
    expect(result).toEqual([...dataSubtypes]);
  });

  it("returns options unchanged when current value is whitespace-only", () => {
    const result = withCurrentOption(dataSubtypes, "   ");
    expect(result).toEqual([...dataSubtypes]);
  });

  it("normalizes current value for comparison (case-insensitive)", () => {
    const result = withCurrentOption(dataSubtypes, "NVS");
    expect(result).toEqual([...dataSubtypes]);
    expect(result).not.toContain("NVS");
  });

  it("works with empty options array", () => {
    const result = withCurrentOption([], "custom");
    expect(result).toEqual(["custom"]);
  });

  it("works with empty options and empty current value", () => {
    const result = withCurrentOption([], "");
    expect(result).toEqual([]);
  });

  it("appends trimmed lowercase value for unknown entries", () => {
    const result = withCurrentOption(dataSubtypes, "  MyCustom  ");
    expect(result[result.length - 1]).toBe("mycustom");
  });
});
