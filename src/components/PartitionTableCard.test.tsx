import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PartitionTableCard from "./PartitionTableCard";
import type { PartitionDraftRow, PartitionLayoutRow } from "../types";

function makeLayoutRow(overrides: Partial<PartitionLayoutRow>): PartitionLayoutRow {
  return {
    id: "row-1",
    name: "nvs",
    type: "data",
    subtype: "nvs",
    size: "64K",
    encrypted: false,
    offset: 0x10000,
    end: 0x20000,
    sizeBytes: 0x10000,
    flags: "",
    ...overrides,
  };
}

const FLASH_BYTES = 8 * 1024 * 1024;

function renderCard(
  rows: PartitionLayoutRow[],
  handlers: Partial<{
    onAddRow: () => void;
    onUpdateRow: (id: string, updates: Partial<PartitionDraftRow>) => void;
    onRequestDelete: (row: PartitionDraftRow) => void;
  }> = {},
  options: { flashBytes?: number; freeBytes?: number } = {},
) {
  return render(
    <PartitionTableCard
      rows={rows}
      flashBytes={options.flashBytes ?? FLASH_BYTES}
      freeBytes={options.freeBytes ?? 0}
      onAddRow={handlers.onAddRow ?? (() => undefined)}
      onUpdateRow={handlers.onUpdateRow ?? (() => undefined)}
      onRequestDelete={handlers.onRequestDelete ?? (() => undefined)}
    />,
  );
}

describe("PartitionTableCard", () => {
  it("renders the table headers", () => {
    renderCard([makeLayoutRow({})]);

    for (const header of ["Name", "Type", "Subtype", "Offset", "Size", "Hex", "Flags", "Action"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
  });

  it("renders a row's offset and hex size", () => {
    renderCard([makeLayoutRow({ offset: 0x10000, sizeBytes: 0x4000 })]);
    expect(screen.getByText("0x10000")).toBeInTheDocument();
    expect(screen.getByText("0x4000")).toBeInTheDocument();
  });

  it("invokes onAddRow when 'Add Partition' is clicked", () => {
    const onAddRow = vi.fn();
    renderCard([makeLayoutRow({})], { onAddRow });

    fireEvent.click(screen.getByRole("button", { name: /Add Partition/ }));
    expect(onAddRow).toHaveBeenCalledTimes(1);
  });

  it("invokes onUpdateRow when the name is edited", () => {
    const onUpdateRow = vi.fn();
    renderCard([makeLayoutRow({ id: "r1", name: "nvs" })], { onUpdateRow });

    // The Name field is the only free-text input in a row.
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "storage" } });
    expect(onUpdateRow).toHaveBeenCalledWith("r1", { name: "storage" });
  });

  it("trims the name on blur", () => {
    const onUpdateRow = vi.fn();
    renderCard([makeLayoutRow({ id: "r1", name: "nvs" })], { onUpdateRow });

    fireEvent.blur(screen.getByRole("textbox"), { target: { value: "  storage  " } });
    expect(onUpdateRow).toHaveBeenCalledWith("r1", { name: "storage" });
  });

  it("resets the subtype to a valid default when the type changes", () => {
    const onUpdateRow = vi.fn();
    renderCard([makeLayoutRow({ id: "r1", type: "data", subtype: "nvs" })], { onUpdateRow });

    // The first combobox in the row is the Type select.
    const typeSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(typeSelect, { target: { value: "app" } });
    expect(onUpdateRow).toHaveBeenCalledWith("r1", { type: "app", subtype: "factory" });
  });

  it("toggles the encrypted flag when the flags button is clicked", () => {
    const onUpdateRow = vi.fn();
    renderCard([makeLayoutRow({ id: "r1", encrypted: false })], { onUpdateRow });

    fireEvent.click(screen.getByRole("button", { name: /Off/ }));
    expect(onUpdateRow).toHaveBeenCalledWith("r1", { encrypted: true });
  });

  it("shows 'Encrypted' for an encrypted row", () => {
    renderCard([makeLayoutRow({ encrypted: true })]);
    expect(screen.getByRole("button", { name: /Encrypted/ })).toBeInTheDocument();
  });

  it("invokes onRequestDelete with the row when its delete button is clicked", () => {
    const onRequestDelete = vi.fn();
    const row = makeLayoutRow({ id: "r1", name: "nvs" });
    renderCard([row], { onRequestDelete });

    fireEvent.click(screen.getByTitle("Delete partition"));
    expect(onRequestDelete).toHaveBeenCalledWith(row);
  });

  it("renders one row per partition", () => {
    renderCard([
      makeLayoutRow({ id: "r1", name: "nvs" }),
      makeLayoutRow({ id: "r2", name: "factory" }),
    ]);
    expect(screen.getAllByTitle("Delete partition")).toHaveLength(2);
  });

  it("clamps a typed size to the space available from the row's offset", () => {
    const onUpdateRow = vi.fn();
    // 2 MB flash, partition at 0x20000 → ceiling is 0x1E0000 = 1920 KB.
    const row = makeLayoutRow({
      id: "r1",
      name: "factory",
      type: "app",
      subtype: "factory",
      offset: 0x20000,
      size: "1024K",
      sizeBytes: 0x100000,
      end: 0x120000,
    });
    renderCard([row], { onUpdateRow }, { flashBytes: 2 * 1024 * 1024 });

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "9000" } });
    expect(onUpdateRow).toHaveBeenCalledWith("r1", { size: "1920K" });
  });

  it("fills the partition with the remaining free space", () => {
    const onUpdateRow = vi.fn();
    const row = makeLayoutRow({
      id: "r1",
      name: "factory",
      type: "app",
      subtype: "factory",
      offset: 0x20000,
      size: "1024K",
      sizeBytes: 0x100000,
      end: 0x120000,
    });
    // 0xE0000 (896 KB) free → 0x100000 + 0xE0000 = 0x1E0000 = 1920 KB.
    renderCard([row], { onUpdateRow }, { flashBytes: 2 * 1024 * 1024, freeBytes: 0xe0000 });

    fireEvent.click(screen.getByRole("button", { name: "Fill remaining free space" }));
    expect(onUpdateRow).toHaveBeenCalledWith("r1", { size: "1920K" });
  });

  it("disables the fill button when no space is free", () => {
    renderCard([makeLayoutRow({})], {}, { freeBytes: 0 });
    expect(
      screen.getByRole("button", { name: "Fill remaining free space" }),
    ).toBeDisabled();
  });
});
