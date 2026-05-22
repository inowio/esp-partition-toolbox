import { describe, expect, it } from "vitest";
import {
  calculateLayout,
  composeSizeString,
  convertSizeUnit,
  createEmptyRow,
  decomposeSize,
  defaultRowsForFlashSize,
  formatBytes,
  formatHex,
  formatSizeToPartitionUnit,
  normalizeSizeInput,
  parsePartitionCsv,
  parseSizeToBytes,
  serializePartitionCsv,
} from "./partition";
import type { PartitionDraftRow } from "../types";

describe("parseSizeToBytes", () => {
  it("parses hex values", () => {
    expect(parseSizeToBytes("0x10000")).toBe(0x10000);
    expect(parseSizeToBytes("0X1D0000")).toBe(0x1d0000);
  });

  it("parses K/M suffixed values", () => {
    expect(parseSizeToBytes("64K")).toBe(64 * 1024);
    expect(parseSizeToBytes("4k")).toBe(4 * 1024);
    expect(parseSizeToBytes("1M")).toBe(1024 * 1024);
    expect(parseSizeToBytes("2m")).toBe(2 * 1024 * 1024);
  });

  it("parses plain decimal values", () => {
    expect(parseSizeToBytes("4096")).toBe(4096);
    expect(parseSizeToBytes("1048576")).toBe(1048576);
  });

  it("returns null for empty or invalid input", () => {
    expect(parseSizeToBytes("")).toBeNull();
    expect(parseSizeToBytes("abc")).toBeNull();
    expect(parseSizeToBytes("64G")).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(parseSizeToBytes("  64K  ")).toBe(64 * 1024);
    expect(parseSizeToBytes("  0x1000  ")).toBe(0x1000);
    expect(parseSizeToBytes("  4096  ")).toBe(4096);
  });

  it("handles 0 as a valid decimal value", () => {
    expect(parseSizeToBytes("0")).toBe(0);
  });

  it("handles 0x0 as valid hex", () => {
    expect(parseSizeToBytes("0x0")).toBe(0);
  });

  it("rejects mixed formats like '64KB'", () => {
    expect(parseSizeToBytes("64KB")).toBeNull();
  });

  it("rejects negative values", () => {
    expect(parseSizeToBytes("-1")).toBeNull();
    expect(parseSizeToBytes("-64K")).toBeNull();
  });

  it("rejects hex with invalid characters", () => {
    expect(parseSizeToBytes("0xGG")).toBeNull();
    expect(parseSizeToBytes("0x")).toBeNull();
  });

  it("handles large values", () => {
    expect(parseSizeToBytes("512M")).toBe(512 * 1024 * 1024);
    expect(parseSizeToBytes("0xFFFFFFFF")).toBe(0xffffffff);
  });
});

describe("normalizeSizeInput", () => {
  it("uppercases hex values", () => {
    expect(normalizeSizeInput("0x1d0000")).toBe("0X1D0000");
  });

  it("uppercases unit suffix", () => {
    expect(normalizeSizeInput("64k")).toBe("64K");
    expect(normalizeSizeInput("2m")).toBe("2M");
  });

  it("passes through plain decimal", () => {
    expect(normalizeSizeInput("4096")).toBe("4096");
  });

  it("returns cleaned value for unknown input", () => {
    expect(normalizeSizeInput("  hello  ")).toBe("HELLO");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeSizeInput("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeSizeInput("   ")).toBe("");
  });

  it("strips leading zeros from decimal values", () => {
    expect(normalizeSizeInput("0064K")).toBe("64K");
    expect(normalizeSizeInput("0004096")).toBe("4096");
  });

  it("preserves hex format for 0x0", () => {
    expect(normalizeSizeInput("0x0")).toBe("0X0");
  });
});

describe("formatHex", () => {
  it("formats numbers as uppercase hex with 0x prefix", () => {
    expect(formatHex(0x10000)).toBe("0x10000");
    expect(formatHex(0)).toBe("0x0");
    expect(formatHex(0x8000)).toBe("0x8000");
  });

  it("formats large flash addresses", () => {
    expect(formatHex(0x800000)).toBe("0x800000");
    expect(formatHex(0xffffffff)).toBe("0xFFFFFFFF");
  });

  it("formats 1 as 0x1", () => {
    expect(formatHex(1)).toBe("0x1");
  });
});

describe("formatBytes", () => {
  it("formats bytes < 1024 as B", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats KB range", () => {
    expect(formatBytes(64 * 1024)).toBe("64.00 KB");
  });

  it("formats MB range", () => {
    expect(formatBytes(8 * 1024 * 1024)).toBe("8.00 MB");
  });

  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats exactly 1024 as KB", () => {
    expect(formatBytes(1024)).toBe("1.00 KB");
  });

  it("formats exactly 1MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.00 MB");
  });

  it("formats fractional KB", () => {
    expect(formatBytes(1536)).toBe("1.50 KB");
  });

  it("formats fractional MB", () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.50 MB");
  });

  it("formats 1 byte", () => {
    expect(formatBytes(1)).toBe("1 B");
  });
});

describe("formatSizeToPartitionUnit", () => {
  it("formats exact MB values", () => {
    expect(formatSizeToPartitionUnit(1024 * 1024)).toBe("1M");
    expect(formatSizeToPartitionUnit(2 * 1024 * 1024)).toBe("2M");
    expect(formatSizeToPartitionUnit(8 * 1024 * 1024)).toBe("8M");
  });

  it("formats exact KB values", () => {
    expect(formatSizeToPartitionUnit(4 * 1024)).toBe("4K");
    expect(formatSizeToPartitionUnit(64 * 1024)).toBe("64K");
    expect(formatSizeToPartitionUnit(512 * 1024)).toBe("512K");
    expect(formatSizeToPartitionUnit(1536 * 1024)).toBe("1536K");
  });

  it("falls back to hex for non-round values", () => {
    expect(formatSizeToPartitionUnit(0x1234)).toBe("0x1234");
    expect(formatSizeToPartitionUnit(5000)).toBe("0x1388");
  });

  it("returns '0' for zero or negative", () => {
    expect(formatSizeToPartitionUnit(0)).toBe("0");
    expect(formatSizeToPartitionUnit(-1)).toBe("0");
  });

  it("prefers MB over KB for values divisible by both", () => {
    expect(formatSizeToPartitionUnit(4 * 1024 * 1024)).toBe("4M");
  });

  it("uses KB for half-MB values", () => {
    expect(formatSizeToPartitionUnit(1.5 * 1024 * 1024)).toBe("1536K");
  });
});

describe("decomposeSize", () => {
  it("decomposes exact MB values", () => {
    expect(decomposeSize(1024 * 1024)).toEqual({ value: 1, unit: "M" });
    expect(decomposeSize(4 * 1024 * 1024)).toEqual({ value: 4, unit: "M" });
  });

  it("decomposes exact KB values", () => {
    expect(decomposeSize(4 * 1024)).toEqual({ value: 4, unit: "K" });
    expect(decomposeSize(64 * 1024)).toEqual({ value: 64, unit: "K" });
    expect(decomposeSize(1536 * 1024)).toEqual({ value: 1536, unit: "K" });
  });

  it("falls back to bytes for non-KB-aligned values", () => {
    expect(decomposeSize(5000)).toEqual({ value: 5000, unit: "B" });
  });

  it("returns 0 K for zero or negative", () => {
    expect(decomposeSize(0)).toEqual({ value: 0, unit: "K" });
    expect(decomposeSize(-1)).toEqual({ value: 0, unit: "K" });
  });

  it("prefers MB when divisible by both KB and MB", () => {
    expect(decomposeSize(2 * 1024 * 1024)).toEqual({ value: 2, unit: "M" });
  });

  it("decomposes hex CSV values correctly (0x1D0000 = 1856K)", () => {
    expect(decomposeSize(0x1d0000)).toEqual({ value: 1856, unit: "K" });
  });
});

describe("composeSizeString", () => {
  it("composes KB values", () => {
    expect(composeSizeString(64, "K")).toBe("64K");
  });

  it("composes MB values", () => {
    expect(composeSizeString(2, "M")).toBe("2M");
  });

  it("composes byte values as plain decimal", () => {
    expect(composeSizeString(4096, "B")).toBe("4096");
  });

  it("returns '0' for zero or negative value", () => {
    expect(composeSizeString(0, "K")).toBe("0");
    expect(composeSizeString(-1, "M")).toBe("0");
  });
});

describe("convertSizeUnit", () => {
  it("converts K to M", () => {
    expect(convertSizeUnit(1024, "K", "M")).toBe(1);
  });

  it("converts M to K", () => {
    expect(convertSizeUnit(2, "M", "K")).toBe(2048);
  });

  it("converts K to B", () => {
    expect(convertSizeUnit(4, "K", "B")).toBe(4096);
  });

  it("converts B to K", () => {
    expect(convertSizeUnit(65536, "B", "K")).toBe(64);
  });

  it("rounds and clamps to minimum 1 when result would be 0", () => {
    expect(convertSizeUnit(4, "K", "M")).toBe(1);
  });

  it("rounds non-exact conversions", () => {
    expect(convertSizeUnit(1536, "K", "M")).toBe(2);
  });

  it("same-unit conversion is identity", () => {
    expect(convertSizeUnit(64, "K", "K")).toBe(64);
  });
});

describe("defaultRowsForFlashSize", () => {
  it("returns minimal default partition rows", () => {
    const rows = defaultRowsForFlashSize(8);
    expect(rows).toHaveLength(3);

    const names = rows.map((r) => r.name);
    expect(names).toContain("nvs");
    expect(names).toContain("phy_init");
    expect(names).toContain("factory");
    expect(names).not.toContain("otadata");
    expect(names).not.toContain("spiffs");
  });

  it("uses full remaining flash for app on 2MB flash", () => {
    const rows = defaultRowsForFlashSize(2);
    const factory = rows.find((r) => r.name === "factory");
    expect(factory?.size).toBe("1920K");
  });

  it("uses full remaining flash for app on 8MB flash", () => {
    const rows = defaultRowsForFlashSize(8);
    const factory = rows.find((r) => r.name === "factory");
    expect(factory?.size).toBe("8064K");
  });

  it("assigns unique IDs to each row", () => {
    const rows = defaultRowsForFlashSize(8);
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.size).toBe(rows.length);
  });
});

describe("createEmptyRow", () => {
  it("returns a valid partition row with defaults", () => {
    const row = createEmptyRow();
    expect(row.name).toBe("partition");
    expect(row.type).toBe("data");
    expect(row.subtype).toBe("spiffs");
    expect(row.size).toBe("64K");
    expect(row.encrypted).toBe(false);
    expect(row.id).toBeTruthy();
  });

  it("generates unique IDs across calls", () => {
    const a = createEmptyRow();
    const b = createEmptyRow();
    expect(a.id).not.toBe(b.id);
  });
});

describe("parsePartitionCsv", () => {
  const SAMPLE_CSV = [
    "# ESP32-S3 8MB flash",
    "# Name, Type, SubType, Offset, Size, Flags",
    "nvs, data, nvs, 0x10000, 64K,",
    "otadata, data, ota, 0x20000, 8K,",
    "phy_init, data, phy, 0x22000, 4K,",
    "factory, app, factory, 0x23000, 0x180000,",
    "spiffs, data, spiffs, 0x1A3000, 0x100000,",
    "",
  ].join("\n");

  it("parses valid CSV into rows", () => {
    const result = parsePartitionCsv(SAMPLE_CSV);
    expect(result.rows).toHaveLength(5);
    expect(result.errors).toHaveLength(0);
  });

  it("extracts comments, excluding default header comment", () => {
    const result = parsePartitionCsv(SAMPLE_CSV);
    expect(result.comments).toBe("ESP32-S3 8MB flash");
  });

  it("excludes generated flash comment from extracted comments", () => {
    const csv = [
      "# Generated by ESP Partition Toolbox for 2 MB flash",
      "# User note",
      "# Name, Type, SubType, Offset, Size, Flags",
      "nvs, data, nvs, 0x10000, 16K,",
      "phy_init, data, phy, 0x14000, 4K,",
      "factory, app, factory, 0x20000, 1920K,",
    ].join("\n");

    const result = parsePartitionCsv(csv);
    expect(result.comments).toBe("User note");
  });

  it("normalizes row types and subtypes to lowercase", () => {
    const csv = "MyPart, DATA, NVS, 0x10000, 64K,\n";
    const result = parsePartitionCsv(csv);
    expect(result.rows[0].type).toBe("data");
    expect(result.rows[0].subtype).toBe("nvs");
  });

  it("reports malformed rows with fewer than 5 columns", () => {
    const csv = "bad,row,only\n";
    const result = parsePartitionCsv(csv);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].severity).toBe("warning");
  });

  it("reports invalid size values as blocking errors", () => {
    const csv = "part, data, nvs, 0x10000, BADSIZE,\n";
    const result = parsePartitionCsv(csv);
    const sizeError = result.errors.find((e) => e.message.includes("Invalid partition size"));
    expect(sizeError).toBeDefined();
    expect(sizeError?.severity).toBe("blocking");
  });

  it("detects encrypted flag", () => {
    const csv = "secure, data, nvs, 0x10000, 64K, encrypted\n";
    const result = parsePartitionCsv(csv);
    expect(result.rows[0].encrypted).toBe(true);
  });

  it("returns default rows when CSV has no data rows", () => {
    const csv = "# just a comment\n";
    const result = parsePartitionCsv(csv);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.message.includes("No usable partition rows"))).toBe(true);
  });

  it("handles CRLF line endings", () => {
    const csv = "nvs, data, nvs, 0x10000, 64K,\r\nfactory, app, factory, 0x20000, 1M,\r\n";
    const result = parsePartitionCsv(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it("handles empty string input", () => {
    const result = parsePartitionCsv("");
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.message.includes("No usable partition rows"))).toBe(true);
    expect(result.comments).toBe("");
  });

  it("handles whitespace-only input", () => {
    const result = parsePartitionCsv("   \n  \n  ");
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.message.includes("No usable partition rows"))).toBe(true);
  });

  it("preserves multiple user comments", () => {
    const csv = "# Comment line 1\n# Comment line 2\n# Comment line 3\nnvs, data, nvs, 0x10000, 64K,\n";
    const result = parsePartitionCsv(csv);
    expect(result.comments).toBe("Comment line 1\nComment line 2\nComment line 3");
  });

  it("applies default name when CSV column is empty", () => {
    const csv = ", data, nvs, 0x10000, 64K,\n";
    const result = parsePartitionCsv(csv);
    expect(result.rows[0].name).toBe("partition");
  });

  it("applies default type and subtype when CSV columns are empty", () => {
    const csv = "mypart, , , 0x10000, 64K,\n";
    const result = parsePartitionCsv(csv);
    expect(result.rows[0].type).toBe("data");
    expect(result.rows[0].subtype).toBe("nvs");
  });

  it("keeps invalid size string so the user can fix it", () => {
    const csv = "mypart, data, nvs, 0x10000, BADSIZE,\n";
    const result = parsePartitionCsv(csv);
    expect(result.rows[0].size).toBe("BADSIZE");
    expect(result.errors.some((e) => e.message.includes("Invalid partition size"))).toBe(true);
  });

  it("applies default 64K size when size column is empty", () => {
    const csv = "mypart, data, nvs, 0x10000, ,\n";
    const result = parsePartitionCsv(csv);
    expect(result.rows[0].size).toBe("64K");
  });

  it("does not treat encrypted as true when flags column is empty", () => {
    const csv = "mypart, data, nvs, 0x10000, 64K,\n";
    const result = parsePartitionCsv(csv);
    expect(result.rows[0].encrypted).toBe(false);
  });

  it("handles rows with exactly 5 columns (no flags column)", () => {
    const csv = "mypart, data, nvs, 0x10000, 64K\n";
    const result = parsePartitionCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].encrypted).toBe(false);
    expect(result.errors).toHaveLength(0);
  });

  it("handles mixed valid and invalid rows", () => {
    const csv = "nvs, data, nvs, 0x10000, 64K,\nbad,row\nfactory, app, factory, 0x20000, 1M,\n";
    const result = parsePartitionCsv(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].severity).toBe("warning");
  });

  it("skips blank lines between valid rows", () => {
    const csv = "nvs, data, nvs, 0x10000, 64K,\n\n\nfactory, app, factory, 0x20000, 1M,\n";
    const result = parsePartitionCsv(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it("generates unique IDs for each parsed row", () => {
    const csv = "nvs, data, nvs, 0x10000, 64K,\nfactory, app, factory, 0x20000, 1M,\n";
    const result = parsePartitionCsv(csv);
    expect(result.rows[0].id).not.toBe(result.rows[1].id);
  });

  it("ignores the offset column (auto-offset is used in layout)", () => {
    const csv = "nvs, data, nvs, 0xDEAD, 64K,\n";
    const result = parsePartitionCsv(csv);
    expect(result.rows[0].name).toBe("nvs");
    expect(result.errors).toHaveLength(0);
  });
});

describe("calculateLayout", () => {
  function makeRows(sizes: string[]): PartitionDraftRow[] {
    return sizes.map((size, i) => ({
      id: `row-${i}`,
      name: `part_${i}`,
      type: "data",
      subtype: "nvs",
      size,
      encrypted: false,
    }));
  }

  it("assigns auto-aligned offsets starting from partition start", () => {
    const rows = makeRows(["64K", "8K"]);
    const layout = calculateLayout(rows, 8);
    expect(layout.rows[0].offset).toBe(0x10000);
    expect(layout.rows[0].sizeBytes).toBe(64 * 1024);
    expect(layout.rows[1].offset).toBe(0x10000 + 64 * 1024);
  });

  it("calculates allocated and free space correctly", () => {
    const rows = makeRows(["64K"]);
    const layout = calculateLayout(rows, 2);
    const flashBytes = 2 * 1024 * 1024;
    const usable = flashBytes - 0x10000;

    expect(layout.flashBytes).toBe(flashBytes);
    expect(layout.allocated).toBe(64 * 1024);
    expect(layout.free).toBe(usable - 64 * 1024);
  });

  it("emits blocking error for partitions exceeding flash boundary", () => {
    const rows = makeRows(["2M"]);
    const layout = calculateLayout(rows, 2);
    const boundaryError = layout.errors.find((e) => e.message.includes("exceeds flash boundary"));
    expect(boundaryError).toBeDefined();
    expect(boundaryError?.severity).toBe("blocking");
  });

  it("emits blocking error when total allocation exceeds usable space", () => {
    const rows = makeRows(["4M"]);
    const layout = calculateLayout(rows, 2);
    const overflowError = layout.errors.find((e) => e.message.includes("exceeds available flash"));
    expect(overflowError).toBeDefined();
    expect(overflowError?.severity).toBe("blocking");
  });

  it("emits warning for non-4KB-aligned sizes", () => {
    const rows = makeRows(["5000"]);
    const layout = calculateLayout(rows, 8);
    const alignError = layout.errors.find((e) => e.message.includes("not 4KB aligned"));
    expect(alignError).toBeDefined();
    expect(alignError?.severity).toBe("warning");
  });

  it("handles invalid size gracefully (row stays in layout with 0 bytes)", () => {
    const rows = makeRows(["BADVAL"]);
    const layout = calculateLayout(rows, 8);
    expect(layout.rows).toHaveLength(1);
    expect(layout.rows[0].sizeBytes).toBe(0);
    const sizeError = layout.errors.find((e) => e.message.includes("Invalid size"));
    expect(sizeError).toBeDefined();
    expect(sizeError?.severity).toBe("blocking");
  });

  it("respects custom partition offset", () => {
    const rows = makeRows(["64K"]);
    const layout = calculateLayout(rows, 8, "0x9000");
    expect(layout.rows[0].offset).toBe(0x10000);
  });

  it("handles empty rows array", () => {
    const layout = calculateLayout([], 8);
    expect(layout.rows).toHaveLength(0);
    expect(layout.allocated).toBe(0);
    expect(layout.free).toBe(layout.usable);
  });

  it("accepts partition offset as a number", () => {
    const rows = makeRows(["64K"]);
    const layout = calculateLayout(rows, 8, 0x9000);
    expect(layout.rows[0].offset).toBe(0x10000);
  });

  it("defaults to 0x10000 start when offset is undefined", () => {
    const rows = makeRows(["64K"]);
    const layout = calculateLayout(rows, 8, undefined);
    expect(layout.rows[0].offset).toBe(0x10000);
  });

  it("defaults to 0x10000 start when offset is negative", () => {
    const rows = makeRows(["64K"]);
    const layout = calculateLayout(rows, 8, -100);
    expect(layout.rows[0].offset).toBe(0x10000);
  });

  it("chains multiple row offsets sequentially", () => {
    const rows = makeRows(["64K", "32K", "16K"]);
    const layout = calculateLayout(rows, 8);

    expect(layout.rows[0].offset).toBe(0x10000);
    expect(layout.rows[0].sizeBytes).toBe(64 * 1024);

    expect(layout.rows[1].offset).toBe(0x10000 + 64 * 1024);
    expect(layout.rows[1].sizeBytes).toBe(32 * 1024);

    expect(layout.rows[2].offset).toBe(0x10000 + 64 * 1024 + 32 * 1024);
    expect(layout.rows[2].sizeBytes).toBe(16 * 1024);
  });

  it("propagates encrypted flag to layout row flags", () => {
    const rows: PartitionDraftRow[] = [
      { id: "r1", name: "secure", type: "data", subtype: "nvs", size: "64K", encrypted: true },
      { id: "r2", name: "plain", type: "data", subtype: "nvs", size: "64K", encrypted: false },
    ];
    const layout = calculateLayout(rows, 8);
    expect(layout.rows[0].flags).toBe("encrypted");
    expect(layout.rows[1].flags).toBe("");
  });

  it("normalizes type and subtype to lowercase in layout rows", () => {
    const rows: PartitionDraftRow[] = [
      { id: "r1", name: "p1", type: "DATA", subtype: "NVS", size: "64K", encrypted: false },
      { id: "r2", name: "p2", type: "App", subtype: "Factory", size: "1M", encrypted: false },
    ];
    const layout = calculateLayout(rows, 8);
    expect(layout.rows[0].type).toBe("data");
    expect(layout.rows[0].subtype).toBe("nvs");
    expect(layout.rows[1].type).toBe("app");
    expect(layout.rows[1].subtype).toBe("factory");
  });

  it("aligns data partitions to 4KB and app partitions to 64KB", () => {
    const rows: PartitionDraftRow[] = [
      { id: "r1", name: "nvs", type: "data", subtype: "nvs", size: "5K", encrypted: false },
      { id: "r2", name: "factory", type: "app", subtype: "factory", size: "1M", encrypted: false },
    ];
    const layout = calculateLayout(rows, 8);

    expect(layout.rows[0].offset).toBe(0x10000);
    expect(layout.rows[0].sizeBytes).toBe(8 * 1024);

    expect(layout.rows[1].offset % 0x10000).toBe(0);
    expect(layout.rows[1].offset).toBeGreaterThanOrEqual(0x10000 + 8 * 1024);
  });

  it("calculates correct usable space for different flash sizes", () => {
    for (const mb of [2, 4, 8, 16, 32]) {
      const layout = calculateLayout([], mb);
      const flashBytes = mb * 1024 * 1024;
      expect(layout.flashBytes).toBe(flashBytes);
      expect(layout.usable).toBe(flashBytes - 0x10000);
    }
  });

  it("reports error when partition start offset equals flash size", () => {
    const rows = makeRows(["64K"]);
    const layout = calculateLayout(rows, 2, 0x200000);
    const err = layout.errors.find((e) => e.message.includes("outside the selected flash size"));
    expect(err).toBeDefined();
    expect(err?.severity).toBe("blocking");
  });

  it("sets end = offset + sizeBytes for valid rows", () => {
    const rows = makeRows(["64K"]);
    const layout = calculateLayout(rows, 8);
    expect(layout.rows[0].end).toBe(layout.rows[0].offset + layout.rows[0].sizeBytes);
  });

  it("sets end = offset for invalid-size rows", () => {
    const rows = makeRows(["INVALID"]);
    const layout = calculateLayout(rows, 8);
    expect(layout.rows[0].end).toBe(layout.rows[0].offset);
    expect(layout.rows[0].sizeBytes).toBe(0);
  });

  it("normalizes size string in layout output", () => {
    const rows: PartitionDraftRow[] = [
      { id: "r1", name: "p1", type: "data", subtype: "nvs", size: "  64k  ", encrypted: false },
    ];
    const layout = calculateLayout(rows, 8);
    expect(layout.rows[0].size).toBe("64K");
  });

  it("uses fallback type/subtype for empty strings", () => {
    const rows: PartitionDraftRow[] = [
      { id: "r1", name: "p1", type: "", subtype: "", size: "64K", encrypted: false },
    ];
    const layout = calculateLayout(rows, 8);
    expect(layout.rows[0].type).toBe("data");
    expect(layout.rows[0].subtype).toBe("nvs");
  });

  it("handles a large partition offset that results in higher start", () => {
    const rows = makeRows(["64K"]);
    const layout = calculateLayout(rows, 8, "0x20000");
    expect(layout.rows[0].offset).toBe(0x21000);
  });
});

describe("calculateLayout — ESP-IDF partition rules", () => {
  function makeRow(overrides: Partial<PartitionDraftRow>): PartitionDraftRow {
    return {
      id: `row-${Math.random().toString(36).slice(2, 8)}`,
      name: "part",
      type: "data",
      subtype: "nvs",
      size: "64K",
      encrypted: false,
      ...overrides,
    };
  }

  it("emits blocking error for empty partition name", () => {
    const rows = [makeRow({ name: "" })];
    const layout = calculateLayout(rows, 8);
    const err = layout.errors.find((e) => e.message.includes("name is required"));
    expect(err).toBeDefined();
    expect(err?.severity).toBe("blocking");
  });

  it("emits blocking error for name exceeding 15 characters", () => {
    const rows = [makeRow({ name: "a_very_long_partition_name" })];
    const layout = calculateLayout(rows, 8);
    const err = layout.errors.find((e) => e.message.includes("exceeds 15 characters"));
    expect(err).toBeDefined();
    expect(err?.severity).toBe("blocking");
  });

  it("accepts names with exactly 15 characters", () => {
    const rows = [makeRow({ name: "exactly15chars!" })];
    const layout = calculateLayout(rows, 8);
    const err = layout.errors.find((e) => e.message.includes("exceeds 15 characters"));
    expect(err).toBeUndefined();
  });

  it("emits blocking error for duplicate partition names", () => {
    const rows = [
      makeRow({ name: "nvs" }),
      makeRow({ name: "nvs" }),
    ];
    const layout = calculateLayout(rows, 8);
    const err = layout.errors.find((e) => e.message.includes("Duplicate partition name"));
    expect(err).toBeDefined();
    expect(err?.severity).toBe("blocking");
  });

  it("auto-aligns app partitions to 64KB", () => {
    const rows = [
      makeRow({ name: "nvs", type: "data", subtype: "nvs", size: "20K" }),
      makeRow({ name: "factory", type: "app", subtype: "factory", size: "1M" }),
    ];
    const layout = calculateLayout(rows, 8);
    const factory = layout.rows.find((r) => r.name === "factory");
    expect(factory).toBeDefined();
    expect(factory!.offset % 0x10000).toBe(0);
  });

  it("emits blocking error for app partition not 64KB aligned (manual offset scenario)", () => {
    const rows = [
      makeRow({ name: "nvs", type: "data", subtype: "nvs", size: "64K" }),
      makeRow({ name: "factory", type: "app", subtype: "factory", size: "1M" }),
    ];
    const layout = calculateLayout(rows, 8);
    const alignErr = layout.errors.find((e) => e.message.includes("must be 64KB aligned"));
    expect(alignErr).toBeUndefined();
  });

  it("emits blocking error when more than one factory app exists", () => {
    const rows = [
      makeRow({ name: "factory1", type: "app", subtype: "factory", size: "1M" }),
      makeRow({ name: "factory2", type: "app", subtype: "factory", size: "1M" }),
    ];
    const layout = calculateLayout(rows, 8);
    const err = layout.errors.find((e) => e.message.includes("Only one factory app"));
    expect(err).toBeDefined();
    expect(err?.severity).toBe("blocking");
  });

  it("emits blocking error when OTA app partitions exist without otadata", () => {
    const rows = [
      makeRow({ name: "ota_0", type: "app", subtype: "ota_0", size: "1M" }),
      makeRow({ name: "ota_1", type: "app", subtype: "ota_1", size: "1M" }),
    ];
    const layout = calculateLayout(rows, 8);
    const err = layout.errors.find((e) => e.message.includes("require an otadata partition"));
    expect(err).toBeDefined();
    expect(err?.severity).toBe("blocking");
  });

  it("does not emit OTA data error when otadata exists", () => {
    const rows = [
      makeRow({ name: "otadata", type: "data", subtype: "ota", size: "8K" }),
      makeRow({ name: "ota_0", type: "app", subtype: "ota_0", size: "1M" }),
      makeRow({ name: "ota_1", type: "app", subtype: "ota_1", size: "1M" }),
    ];
    const layout = calculateLayout(rows, 8);
    const err = layout.errors.find((e) => e.message.includes("require an otadata partition"));
    expect(err).toBeUndefined();
  });

  it("emits warning when OTA app partitions have different sizes", () => {
    const rows = [
      makeRow({ name: "otadata", type: "data", subtype: "ota", size: "8K" }),
      makeRow({ name: "ota_0", type: "app", subtype: "ota_0", size: "1M" }),
      makeRow({ name: "ota_1", type: "app", subtype: "ota_1", size: "2M" }),
    ];
    const layout = calculateLayout(rows, 8);
    const err = layout.errors.find((e) => e.message.includes("same size"));
    expect(err).toBeDefined();
    expect(err?.severity).toBe("warning");
  });

  it("does not warn when OTA app partitions have equal sizes", () => {
    const rows = [
      makeRow({ name: "otadata", type: "data", subtype: "ota", size: "8K" }),
      makeRow({ name: "ota_0", type: "app", subtype: "ota_0", size: "1M" }),
      makeRow({ name: "ota_1", type: "app", subtype: "ota_1", size: "1M" }),
    ];
    const layout = calculateLayout(rows, 8);
    const err = layout.errors.find((e) => e.message.includes("same size"));
    expect(err).toBeUndefined();
  });

  it("emits warning when NVS partition is below 12KB minimum", () => {
    const rows = [makeRow({ name: "nvs", type: "data", subtype: "nvs", size: "8K" })];
    const layout = calculateLayout(rows, 8);
    const err = layout.errors.find((e) => e.message.includes("minimum recommended is 12KB"));
    expect(err).toBeDefined();
    expect(err?.severity).toBe("warning");
  });

  it("does not warn for NVS at or above 12KB", () => {
    const rows = [makeRow({ name: "nvs", type: "data", subtype: "nvs", size: "16K" })];
    const layout = calculateLayout(rows, 8);
    const err = layout.errors.find((e) => e.message.includes("minimum recommended is 12KB"));
    expect(err).toBeUndefined();
  });

  it("default rows for 8MB flash produce no blocking errors", () => {
    const layout = calculateLayout(defaultRowsForFlashSize(8), 8);
    const blockingErrors = layout.errors.filter((e) => e.severity === "blocking");
    expect(blockingErrors).toHaveLength(0);
  });
});

describe("serializePartitionCsv", () => {
  it("serializes layout rows to CSV with header comment", () => {
    const layout = calculateLayout(defaultRowsForFlashSize(8), 8);
    const csv = serializePartitionCsv("My notes", layout.rows);

    expect(csv).toContain("# Generated by ESP Partition Toolbox for 8 MB flash");
    expect(csv).toContain("# My notes");
    expect(csv).toContain("# Name,");
    expect(csv).toContain("nvs, data, nvs,");
    expect(csv.endsWith("\n")).toBe(true);
  });

  it("does not duplicate generated flash comment if user typed one", () => {
    const layout = calculateLayout(defaultRowsForFlashSize(2), 2);
    const csv = serializePartitionCsv("Generated by ESP Partition Toolbox for 2 MB flash\ncustom", layout.rows);

    const generatedLines = csv
      .split("\n")
      .filter((line) => line.includes("Generated by ESP Partition Toolbox for 8 MB flash"));

    expect(generatedLines).toHaveLength(1);
    expect(csv).toContain("# custom");
  });

  it("preserves multi-line comments", () => {
    const layout = calculateLayout(defaultRowsForFlashSize(8), 8);
    const csv = serializePartitionCsv("Line 1\nLine 2", layout.rows);

    expect(csv).toContain("# Line 1");
    expect(csv).toContain("# Line 2");
  });

  it("strips default header comments from user comments", () => {
    const layout = calculateLayout(defaultRowsForFlashSize(8), 8);
    const csv = serializePartitionCsv("Name, Type, SubType, Offset, Size, Flags", layout.rows);

    const headerLines = csv.split("\n").filter((l) => l.startsWith("# Name,"));
    expect(headerLines).toHaveLength(1);
  });

  it("handles empty comments", () => {
    const layout = calculateLayout(defaultRowsForFlashSize(8), 8);
    const csv = serializePartitionCsv("", layout.rows);

    expect(csv).toContain("# Name,");
    expect(csv).toContain("nvs,");
  });

  it("includes encrypted flag in output", () => {
    const rows: PartitionDraftRow[] = [
      { id: "r1", name: "secure", type: "data", subtype: "nvs", size: "64K", encrypted: true },
    ];
    const layout = calculateLayout(rows, 8);
    const csv = serializePartitionCsv("", layout.rows);

    expect(csv).toContain("encrypted");
  });

  it("serializes empty rows array as header-only CSV", () => {
    const csv = serializePartitionCsv("", []);
    expect(csv).toContain("# Name,");
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(2);
  });

  it("preserves row ordering in output", () => {
    const layout = calculateLayout(defaultRowsForFlashSize(8), 8);
    const csv = serializePartitionCsv("", layout.rows);
    const dataLines = csv.split("\n").filter((l) => l && !l.startsWith("#"));
    expect(dataLines[0]).toMatch(/^nvs,/);
    expect(dataLines[1]).toMatch(/^phy_init,/);
    expect(dataLines[2]).toMatch(/^factory,/);
  });

  it("outputs empty string for no-flag rows", () => {
    const rows: PartitionDraftRow[] = [
      { id: "r1", name: "p1", type: "data", subtype: "nvs", size: "64K", encrypted: false },
    ];
    const layout = calculateLayout(rows, 8);
    const csv = serializePartitionCsv("", layout.rows);
    const dataLine = csv.split("\n").find((l) => l.startsWith("p1,"));
    expect(dataLine).toBeDefined();
    expect(dataLine!.endsWith(", ")).toBe(true);
  });

  it("formats offsets as hex in output", () => {
    const layout = calculateLayout(defaultRowsForFlashSize(8), 8);
    const csv = serializePartitionCsv("", layout.rows);
    expect(csv).toContain("0x10000");
  });

  it("handles comments with blank lines", () => {
    const layout = calculateLayout(defaultRowsForFlashSize(8), 8);
    const csv = serializePartitionCsv("Line 1\n\nLine 3", layout.rows);
    expect(csv).toContain("# Line 1");
    expect(csv).toContain("#");
    expect(csv).toContain("# Line 3");
  });

  it("handles CRLF in comments input", () => {
    const layout = calculateLayout(defaultRowsForFlashSize(8), 8);
    const csv = serializePartitionCsv("Line A\r\nLine B", layout.rows);
    expect(csv).toContain("# Line A");
    expect(csv).toContain("# Line B");
  });
});

describe("round-trip: parse → layout → serialize → parse", () => {
  it("preserves partition data through a full round-trip", () => {
    const originalCsv = [
      "# My project config",
      "# Name,     Type, SubType, Offset,    Size,     Flags",
      "nvs, data, nvs, 0x10000, 64K,",
      "otadata, data, ota, 0x20000, 8K,",
      "phy_init, data, phy, 0x22000, 4K,",
      "factory, app, factory, 0x30000, 0x180000,",
      "spiffs, data, spiffs, 0x1B0000, 512K,",
    ].join("\n");

    const parsed1 = parsePartitionCsv(originalCsv);
    expect(parsed1.errors).toHaveLength(0);

    const layout1 = calculateLayout(parsed1.rows, 8);
    const serialized = serializePartitionCsv(parsed1.comments, layout1.rows);

    const parsed2 = parsePartitionCsv(serialized);
    expect(parsed2.errors).toHaveLength(0);

    expect(parsed2.rows).toHaveLength(parsed1.rows.length);
    expect(parsed2.comments).toBe(parsed1.comments);

    for (let i = 0; i < parsed1.rows.length; i++) {
      expect(parsed2.rows[i].name).toBe(parsed1.rows[i].name);
      expect(parsed2.rows[i].type).toBe(parsed1.rows[i].type);
      expect(parsed2.rows[i].subtype).toBe(parsed1.rows[i].subtype);
      expect(parsed2.rows[i].encrypted).toBe(parsed1.rows[i].encrypted);
    }
  });

  it("preserves partition sizes through round-trip", () => {
    const rows = defaultRowsForFlashSize(8);
    const layout1 = calculateLayout(rows, 8);
    const csv = serializePartitionCsv("notes", layout1.rows);
    const parsed = parsePartitionCsv(csv);
    const layout2 = calculateLayout(parsed.rows, 8);

    expect(layout2.allocated).toBe(layout1.allocated);
    expect(layout2.rows).toHaveLength(layout1.rows.length);

    for (let i = 0; i < layout1.rows.length; i++) {
      expect(layout2.rows[i].sizeBytes).toBe(layout1.rows[i].sizeBytes);
      expect(layout2.rows[i].offset).toBe(layout1.rows[i].offset);
    }
  });

  it("preserves encrypted flag through round-trip", () => {
    const rows: PartitionDraftRow[] = [
      { id: "r1", name: "secure_nvs", type: "data", subtype: "nvs", size: "64K", encrypted: true },
      { id: "r2", name: "plain_data", type: "data", subtype: "spiffs", size: "512K", encrypted: false },
    ];

    const layout = calculateLayout(rows, 8);
    const csv = serializePartitionCsv("", layout.rows);
    const parsed = parsePartitionCsv(csv);

    expect(parsed.rows[0].encrypted).toBe(true);
    expect(parsed.rows[1].encrypted).toBe(false);
  });

  it("default rows survive round-trip for all supported flash sizes", () => {
    for (const mb of [2, 4, 8, 16, 32, 64, 128, 256, 512]) {
      const rows = defaultRowsForFlashSize(mb);
      const layout1 = calculateLayout(rows, mb);
      const csv = serializePartitionCsv("", layout1.rows);
      const parsed = parsePartitionCsv(csv);
      const layout2 = calculateLayout(parsed.rows, mb);

      expect(layout2.rows).toHaveLength(layout1.rows.length);
      expect(layout2.allocated).toBe(layout1.allocated);
    }
  });
});
