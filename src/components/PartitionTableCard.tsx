import { useEffect, useRef, useState } from "react";
import { FiAnchor, FiChevronDown, FiList, FiLock, FiMaximize2, FiPlus, FiShield, FiTrash2 } from "react-icons/fi";
import type { PartitionDraftRow, PartitionLayoutRow } from "../types";
import {
  getDefaultSubtypeForType,
  getSubtypeOptionsForType,
  PARTITION_TYPE_OPTIONS,
} from "../constants/partitionOptions";
import {
  composeSizeString,
  convertSizeUnit,
  formatHex,
  formatSizeToPartitionUnit,
  maxSizeBytesForRow,
  parseSizeString,
} from "../utils/partition";
import type { SizeUnit } from "../utils/partition";

// An offset is valid when empty (auto-defaults) or a clean hex/decimal number.
function isValidPartitionOffset(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return /^0x[0-9a-f]+$/.test(normalized) || /^\d+$/.test(normalized);
}

// Each preset is the partition-*table* offset (CONFIG_PARTITION_TABLE_OFFSET).
// Increasing it leaves more room for the bootloader at 0x1000–<offset>.
const PARTITION_OFFSET_PRESETS: { value: string; label: string }[] = [
  { value: "0x8000", label: "ESP-IDF / Arduino-ESP32 default" },
  { value: "0x9000", label: "+4 KB bootloader headroom" },
  { value: "0xA000", label: "+8 KB bootloader headroom" },
  { value: "0xC000", label: "Larger bootloader" },
  { value: "0xE000", label: "Large bootloader / security features" },
  { value: "0x10000", label: "Common preset for secure boot / flash encryption" },
  { value: "0x20000", label: "Advanced — large reserved bootloader area" },
];

const SLIDER_MIN_BYTES = 4 * 1024;
const SLIDER_RESOLUTION = 500;
const SECTOR_BYTES = 4 * 1024;

function sliderPositionToBytes(position: number, maxBytes: number): number {
  if (position <= 0) return SLIDER_MIN_BYTES;
  if (position >= SLIDER_RESOLUTION) return maxBytes;

  const minLog = Math.log(SLIDER_MIN_BYTES);
  const maxLog = Math.log(Math.max(maxBytes, SLIDER_MIN_BYTES * 2));
  const logValue = minLog + (position / SLIDER_RESOLUTION) * (maxLog - minLog);
  const rawBytes = Math.exp(logValue);
  return Math.max(SLIDER_MIN_BYTES, Math.round(rawBytes / 0x1000) * 0x1000);
}

function bytesToSliderPosition(bytes: number, maxBytes: number): number {
  // Check the ceiling first: a partition sitting at its maximum belongs on
  // the right even if that maximum is the 4 KB floor.
  if (bytes >= maxBytes) return SLIDER_RESOLUTION;
  if (bytes <= SLIDER_MIN_BYTES) return 0;

  const minLog = Math.log(SLIDER_MIN_BYTES);
  const maxLog = Math.log(Math.max(maxBytes, SLIDER_MIN_BYTES * 2));
  return Math.round(((Math.log(bytes) - minLog) / (maxLog - minLog)) * SLIDER_RESOLUTION);
}

const SIZE_UNITS: SizeUnit[] = ["B", "K", "M"];
const UNIT_LABELS: Record<SizeUnit, string> = { B: "Bytes", K: "KB", M: "MB" };
const UNIT_STEPS: Record<SizeUnit, number> = { B: 4096, K: 4, M: 1 };
const UNIT_MINS: Record<SizeUnit, number> = { B: 4096, K: 4, M: 1 };
const UNIT_BYTES: Record<SizeUnit, number> = { B: 1, K: 1024, M: 1024 * 1024 };

// Largest whole value expressible in `unit` that still fits within `maxBytes`.
function maxValueForUnit(maxBytes: number, unit: SizeUnit): number {
  return Math.max(Math.floor(maxBytes / UNIT_BYTES[unit]), UNIT_MINS[unit]);
}

// The 4 KB-aligned byte size the layout will store for a `value`/`unit` pair —
// mirrors how calculateLayout parses and aligns the size field.
function committedBytesForSize(value: number, unit: SizeUnit): number {
  return Math.ceil((value * UNIT_BYTES[unit]) / SECTOR_BYTES) * SECTOR_BYTES;
}

function normalizeSelectValue(value: string): string {
  return value.trim().toLowerCase();
}

// Sentinel select value that switches a Type/Subtype cell into custom-input mode.
const CUSTOM_OPTION = "__custom__";

// A type is "custom" when it is a numeric value rather than app/data.
function isCustomTypeValue(type: string): boolean {
  const normalized = normalizeSelectValue(type);
  return normalized !== "" && normalized !== "app" && normalized !== "data";
}

// Lenient hex/decimal byte parse for the inline validity hints on custom inputs.
function parseHexByte(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  if (/^0x[0-9a-f]+$/.test(normalized)) return Number.parseInt(normalized, 16);
  if (/^\d+$/.test(normalized)) return Number.parseInt(normalized, 10);
  return null;
}

function isValidCustomType(value: string): boolean {
  const parsed = parseHexByte(value);
  return parsed != null && parsed >= 0x40 && parsed <= 0xfe;
}

function isValidCustomSubtype(value: string): boolean {
  const parsed = parseHexByte(value);
  return parsed != null && parsed >= 0 && parsed <= 0xfe;
}

// An offset field is valid when empty (auto) or a hex/decimal number.
function isValidOffset(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return /^0x[0-9a-f]+$/.test(normalized) || /^\d+$/.test(normalized);
}

interface PartitionRowProps {
  row: PartitionLayoutRow;
  maxBytes: number;
  advancedMode: boolean;
  onUpdateRow: (id: string, updates: Partial<PartitionDraftRow>) => void;
  onRequestDelete: (row: PartitionDraftRow) => void;
}

function PartitionRow({
  row,
  maxBytes,
  advancedMode,
  onUpdateRow,
  onRequestDelete,
}: PartitionRowProps) {
  const normalizedType = normalizeSelectValue(row.type) || "data";
  const normalizedSubtype = normalizeSelectValue(row.subtype);
  const isCustomType = isCustomTypeValue(row.type);
  const knownSubtypes = getSubtypeOptionsForType(normalizedType);
  const isCustomSubtype = isCustomType || !knownSubtypes.includes(normalizedSubtype);
  // Read-only is an ESP-IDF 5.2+ flag for data partitions, never ota/coredump.
  const readonlyAllowed =
    normalizedType !== "app"
    && normalizedSubtype !== "ota"
    && normalizedSubtype !== "coredump";
  const isOffsetPinned = row.pinnedOffset.trim() !== "";
  const { value: sizeValue, unit: sizeUnit } = parseSizeString(row.size);

  const maxValueInUnit = maxValueForUnit(maxBytes, sizeUnit);
  // When a partition is stuck at the 4 KB minimum with no room to grow, the
  // slider has nothing left to do — lock it instead of leaving a dead control.
  const sliderLocked = maxBytes <= SLIDER_MIN_BYTES;
  const canFill = row.sizeBytes < maxBytes;

  // The slider thumb is local state so a drag stays smooth — deriving it from
  // the 4 KB-snapped committed size would yank the thumb back every render.
  const [sliderPos, setSliderPos] = useState(() =>
    bytesToSliderPosition(row.sizeBytes || SLIDER_MIN_BYTES, maxBytes),
  );
  // What our own last slider commit produced, so the sync effect can tell an
  // outside change (typing, unit toggle, fill, a resized neighbour) from our
  // own drag.
  const sliderCommit = useRef<{ bytes: number; max: number } | null>(null);

  useEffect(() => {
    const sizeBytes = row.sizeBytes || SLIDER_MIN_BYTES;
    const commit = sliderCommit.current;
    if (commit && commit.bytes === sizeBytes && commit.max === maxBytes) {
      // This size is exactly what our slider drag committed — keep the thumb.
      return;
    }
    setSliderPos(bytesToSliderPosition(sizeBytes, maxBytes));
  }, [row.sizeBytes, maxBytes]);

  function handleSliderChange(position: number): void {
    setSliderPos(position);
    const bytes = sliderPositionToBytes(position, maxBytes);
    const value = Math.min(convertSizeUnit(bytes, "B", sizeUnit), maxValueInUnit);
    sliderCommit.current = {
      bytes: committedBytesForSize(value, sizeUnit),
      max: maxBytes,
    };
    onUpdateRow(row.id, { size: composeSizeString(value, sizeUnit) });
  }

  return (
    <tr className="border-t border-slate-200 dark:border-slate-700">
      <td className="px-3 py-2">
        <input
          value={row.name}
          maxLength={15}
          aria-label="Partition name"
          onChange={(event) => onUpdateRow(row.id, { name: event.currentTarget.value })}
          onBlur={(event) => onUpdateRow(row.id, { name: event.currentTarget.value.trim() })}
          className="w-full rounded-md border border-slate-300 bg-transparent px-2 py-1 outline-none focus:border-sky-500 dark:border-slate-700"
        />
      </td>
      <td className="px-3 py-2">
        {isCustomType ? (
          <div className="flex gap-1">
            <input
              value={row.type}
              onChange={(event) => onUpdateRow(row.id, { type: event.currentTarget.value })}
              placeholder="0x40"
              title="Custom partition type — hex 0x40–0xFE"
              className={`w-full rounded-md border bg-transparent px-2 py-1 font-mono outline-none focus:border-sky-500 ${
                isValidCustomType(row.type)
                  ? "border-slate-300 dark:border-slate-700"
                  : "border-rose-400 dark:border-rose-600"
              }`}
            />
            <button
              type="button"
              title="Switch back to a standard type"
              aria-label="Switch back to a standard type"
              onClick={() => onUpdateRow(row.id, { type: "data", subtype: "nvs" })}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <FiList className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <select
            value={normalizedType}
            onChange={(event) => {
              const picked = event.currentTarget.value;
              if (picked === CUSTOM_OPTION) {
                onUpdateRow(row.id, { type: "0x40", subtype: "0x00" });
                return;
              }
              const nextType = normalizeSelectValue(picked);
              const nextSubtypeOptions = getSubtypeOptionsForType(nextType);
              const nextSubtype = nextSubtypeOptions.includes(normalizedSubtype)
                ? normalizedSubtype
                : getDefaultSubtypeForType(nextType);
              onUpdateRow(row.id, { type: nextType, subtype: nextSubtype });
            }}
            className="w-full rounded-md border border-slate-300 bg-transparent px-2 py-1 outline-none focus:border-sky-500 dark:border-slate-700"
          >
            {PARTITION_TYPE_OPTIONS.map((option) => (
              <option key={`${row.id}-type-${option}`} value={option}>
                {option}
              </option>
            ))}
            {advancedMode && <option value={CUSTOM_OPTION}>Custom…</option>}
          </select>
        )}
      </td>
      <td className="px-3 py-2">
        {isCustomSubtype ? (
          <div className="flex gap-1">
            <input
              value={row.subtype}
              onChange={(event) => onUpdateRow(row.id, { subtype: event.currentTarget.value })}
              placeholder="0x00"
              title="Custom subtype — hex 0x00–0xFE"
              className={`w-full rounded-md border bg-transparent px-2 py-1 font-mono outline-none focus:border-sky-500 ${
                isValidCustomSubtype(row.subtype)
                  ? "border-slate-300 dark:border-slate-700"
                  : "border-rose-400 dark:border-rose-600"
              }`}
            />
            {!isCustomType && (
              <button
                type="button"
                title="Switch back to a standard subtype"
                aria-label="Switch back to a standard subtype"
                onClick={() =>
                  onUpdateRow(row.id, { subtype: getDefaultSubtypeForType(normalizedType) })
                }
                className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FiList className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        ) : (
          <select
            value={normalizedSubtype}
            onChange={(event) => {
              const picked = event.currentTarget.value;
              if (picked === CUSTOM_OPTION) {
                onUpdateRow(row.id, { subtype: "0x00" });
                return;
              }
              onUpdateRow(row.id, { subtype: normalizeSelectValue(picked) });
            }}
            className="w-full rounded-md border border-slate-300 bg-transparent px-2 py-1 outline-none focus:border-sky-500 dark:border-slate-700"
          >
            {knownSubtypes.map((option) => (
              <option key={`${row.id}-subtype-${option}`} value={option}>
                {option}
              </option>
            ))}
            {advancedMode && <option value={CUSTOM_OPTION}>Custom…</option>}
          </select>
        )}
      </td>
      <td className="px-3 py-2">
        {advancedMode ? (
          <div className="flex gap-1">
            <input
              value={isOffsetPinned ? row.pinnedOffset : formatHex(row.offset)}
              onChange={(event) =>
                onUpdateRow(row.id, { pinnedOffset: event.currentTarget.value })
              }
              title={
                isOffsetPinned
                  ? "Pinned offset — edit it, or use the anchor button to auto-pack"
                  : "Auto-packed offset — edit it, or use the anchor button, to pin it"
              }
              className={`w-24 rounded-md border bg-transparent px-2 py-1 font-mono text-xs outline-none focus:border-sky-500 ${
                isValidOffset(row.pinnedOffset)
                  ? "border-slate-300 dark:border-slate-700"
                  : "border-rose-400 dark:border-rose-600"
              } ${isOffsetPinned ? "" : "text-slate-400 dark:text-slate-500"}`}
            />
            <button
              type="button"
              onClick={() =>
                onUpdateRow(row.id, {
                  pinnedOffset: isOffsetPinned ? "" : formatHex(row.offset),
                })
              }
              title={
                isOffsetPinned
                  ? "Pinned — click to auto-pack this partition"
                  : "Auto-packed — click to pin this offset"
              }
              aria-label={isOffsetPinned ? "Auto-pack this partition" : "Pin this offset"}
              className={`inline-flex items-center justify-center rounded-md border px-2 ${
                isOffsetPinned
                  ? "border-sky-500 text-sky-600 dark:text-sky-400"
                  : "border-slate-300 text-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              }`}
            >
              <FiAnchor className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {formatHex(row.offset)}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <input
            type="number"
            value={sizeValue}
            min={UNIT_MINS[sizeUnit]}
            max={maxValueInUnit}
            step={UNIT_STEPS[sizeUnit]}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              if (!Number.isFinite(next) || next < 0) {
                return;
              }
              // Never accept a size that would overrun a later partition.
              const clamped = Math.min(next, maxValueInUnit);
              onUpdateRow(row.id, { size: composeSizeString(clamped, sizeUnit) });
            }}
            className="w-20 min-w-0 flex-1 rounded-md border border-slate-300 bg-transparent px-2 py-1 font-mono outline-none focus:border-sky-500 dark:border-slate-700"
          />
          <select
            value={sizeUnit}
            onChange={(event) => {
              const nextUnit = event.currentTarget.value as SizeUnit;
              const converted = convertSizeUnit(sizeValue, sizeUnit, nextUnit);
              const clamped = Math.min(converted, maxValueForUnit(maxBytes, nextUnit));
              onUpdateRow(row.id, { size: composeSizeString(clamped, nextUnit) });
            }}
            className="w-18 rounded-md border border-slate-300 bg-transparent px-1 py-1 text-xs outline-none focus:border-sky-500 dark:border-slate-700"
          >
            {SIZE_UNITS.map((u) => (
              <option key={`${row.id}-unit-${u}`} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              onUpdateRow(row.id, { size: formatSizeToPartitionUnit(maxBytes) })
            }
            disabled={!canFill}
            title="Fill remaining free space"
            aria-label="Fill remaining free space"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-2 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FiMaximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={SLIDER_RESOLUTION}
          value={sliderPos}
          disabled={sliderLocked}
          onChange={(event) => handleSliderChange(Number(event.currentTarget.value))}
          className="size-slider mt-1.5 disabled:cursor-not-allowed disabled:opacity-40"
          title={
            sliderLocked
              ? "No room to resize — free up space in another partition first"
              : `Drag to resize (4K — ${formatSizeToPartitionUnit(maxBytes)})`
          }
        />
      </td>
      <td className="px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
        {row.sizeBytes > 0 ? formatHex(row.sizeBytes) : "—"}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onUpdateRow(row.id, { encrypted: !row.encrypted })}
            title={
              row.encrypted
                ? "Encrypted when flash encryption is enabled — click to clear"
                : "Mark this partition encrypted (takes effect when flash encryption is enabled)"
            }
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              row.encrypted
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/45 dark:text-emerald-300"
                : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
            }`}
          >
            <FiShield className="h-3 w-3" aria-hidden="true" />
            Encrypted
          </button>
          <button
            type="button"
            disabled={!readonlyAllowed && !row.readonly}
            onClick={() => onUpdateRow(row.id, { readonly: !row.readonly })}
            title={
              !readonlyAllowed
                ? "Read-only applies only to data partitions — not app, ota or coredump"
                : "Mark this data partition as read-only (ESP-IDF version > 5.2 only)"
            }
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              row.readonly
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/45 dark:text-emerald-300"
                : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
            }`}
          >
            <FiLock className="h-3 w-3" aria-hidden="true" />
            Read-only
          </button>
        </div>
      </td>
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          onClick={() => onRequestDelete(row)}
          className="inline-flex items-center justify-center rounded-md border border-rose-300 p-2 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/25"
          title="Delete partition"
        >
          <FiTrash2 />
        </button>
      </td>
    </tr>
  );
}

interface PartitionTableCardProps {
  rows: PartitionLayoutRow[];
  flashBytes: number;
  partitionOffset?: string;
  onPartitionOffsetChange?: (value: string) => void;
  onAddRow: () => void;
  onUpdateRow: (id: string, updates: Partial<PartitionDraftRow>) => void;
  onRequestDelete: (row: PartitionDraftRow) => void;
}

export default function PartitionTableCard({
  rows,
  flashBytes,
  partitionOffset = "",
  onPartitionOffsetChange = () => undefined,
  onAddRow,
  onUpdateRow,
  onRequestDelete,
}: PartitionTableCardProps) {
  // Advanced mode unlocks editable offsets and custom numeric types/subtypes.
  // It is purely a view preference, so it lives as local state in this card.
  const [advancedMode, setAdvancedMode] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const presetsRef = useRef<HTMLLabelElement | null>(null);

  // Close the offset-presets popup on outside click or Escape — the same
  // pattern the editable-field context menu uses.
  useEffect(() => {
    if (!presetsOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (presetsRef.current && presetsRef.current.contains(event.target as Node)) {
        return;
      }
      setPresetsOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPresetsOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [presetsOpen]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Partition Table Definition</h2>

        <div className="flex flex-wrap items-center gap-4">
          <label
            ref={presetsRef}
            className="relative flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800/60 text-sm text-slate-600 dark:text-slate-300"
            title="Partition table offset (CONFIG_PARTITION_TABLE_OFFSET). Most projects use 0x8000; some configs need 0x9000 or higher."
          >
            <span className="font-medium">Partition Start</span>
            <input
              value={partitionOffset}
              onChange={(event) => onPartitionOffsetChange(event.currentTarget.value)}
              aria-label="Partition table offset"
              placeholder="0x8000"
              className={`w-28 rounded border bg-transparent px-2 py-1 font-mono text-sm outline-none focus:border-sky-500 ${
                isValidPartitionOffset(partitionOffset)
                  ? "border-slate-300 dark:border-slate-700"
                  : "border-rose-400 dark:border-rose-600"
              }`}
            />
            <button
              type="button"
              onClick={() => setPresetsOpen((open) => !open)}
              aria-label="Show common partition table offsets"
              aria-expanded={presetsOpen}
              aria-haspopup="menu"
              title="Common offsets"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <FiChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
            {presetsOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-1 min-w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
              >
                {PARTITION_OFFSET_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onPartitionOffsetChange(preset.value);
                      setPresetsOpen(false);
                    }}
                    className="block w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <div className="font-mono text-sm font-semibold text-sky-700 dark:text-sky-300">
                      {preset.value}
                    </div>
                    {preset.label && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {preset.label}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </label>
          <label
            className="flex cursor-pointer items-center gap-2 text-sm select-none"
            title="Unlocks editable offsets and custom partition types"
          >
            <span className="font-medium text-slate-600 dark:text-slate-300">Advanced</span>
            <span
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                advancedMode ? "bg-sky-600" : "bg-slate-300 dark:bg-slate-600"
              }`}
            >
              <input
                type="checkbox"
                checked={advancedMode}
                onChange={(event) => setAdvancedMode(event.currentTarget.checked)}
                className="peer sr-only"
              />
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  advancedMode ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </span>
          </label>

          <button
            type="button"
            onClick={onAddRow}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            <FiPlus /> Add Partition
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-280 border-collapse text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800/90">
            <tr>
              {/* Name / Type / Subtype get fixed widths; Size stays flexible
                  and absorbs the slack (it holds the slider). Display-only
                  columns shrink to their content (w-px). */}
              <th className="w-44 px-3 py-2 text-left font-semibold">Name</th>
              <th className="w-28 px-3 py-2 text-left font-semibold">Type</th>
              <th className="w-36 px-3 py-2 text-left font-semibold">Subtype</th>
              <th className="w-px px-3 py-2 text-left font-semibold whitespace-nowrap">Offset</th>
              <th className="px-3 py-2 text-left font-semibold">Size</th>
              <th className="w-px px-3 py-2 text-left font-semibold whitespace-nowrap">Hex</th>
              <th className="w-32 px-3 py-2 text-left font-semibold whitespace-nowrap">Flags</th>
              <th className="w-px px-3 py-2 text-center font-semibold whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <PartitionRow
                key={row.id}
                row={row}
                maxBytes={maxSizeBytesForRow(rows, index, flashBytes)}
                advancedMode={advancedMode}
                onUpdateRow={onUpdateRow}
                onRequestDelete={onRequestDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
