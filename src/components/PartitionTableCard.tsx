import { useEffect, useRef, useState } from "react";
import { FiMaximize2, FiPlus, FiShield, FiTrash2 } from "react-icons/fi";
import type { PartitionDraftRow, PartitionLayoutRow } from "../types";
import {
  getDefaultSubtypeForType,
  getSubtypeOptionsForType,
  PARTITION_TYPE_OPTIONS,
  withCurrentOption,
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

interface PartitionRowProps {
  row: PartitionLayoutRow;
  maxBytes: number;
  onUpdateRow: (id: string, updates: Partial<PartitionDraftRow>) => void;
  onRequestDelete: (row: PartitionDraftRow) => void;
}

function PartitionRow({ row, maxBytes, onUpdateRow, onRequestDelete }: PartitionRowProps) {
  const normalizedType = normalizeSelectValue(row.type) || "data";
  const normalizedSubtype = normalizeSelectValue(row.subtype);
  const typeOptions = withCurrentOption(PARTITION_TYPE_OPTIONS, normalizedType);
  const subtypeOptions = withCurrentOption(
    getSubtypeOptionsForType(normalizedType),
    normalizedSubtype,
  );
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
          onChange={(event) => onUpdateRow(row.id, { name: event.currentTarget.value })}
          onBlur={(event) => onUpdateRow(row.id, { name: event.currentTarget.value.trim() })}
          className="w-full rounded-md border border-slate-300 bg-transparent px-2 py-1 outline-none focus:border-sky-500 dark:border-slate-700"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={normalizedType}
          onChange={(event) => {
            const nextType = normalizeSelectValue(event.currentTarget.value);
            const nextSubtypeOptions = getSubtypeOptionsForType(nextType);
            const nextSubtype = nextSubtypeOptions.includes(normalizedSubtype)
              ? normalizedSubtype
              : getDefaultSubtypeForType(nextType);

            onUpdateRow(row.id, { type: nextType, subtype: nextSubtype });
          }}
          className="w-full rounded-md border border-slate-300 bg-transparent px-2 py-1 outline-none focus:border-sky-500 dark:border-slate-700"
        >
          {typeOptions.map((option) => (
            <option key={`${row.id}-type-${option}`} value={option}>
              {option}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          value={normalizedSubtype}
          onChange={(event) =>
            onUpdateRow(row.id, { subtype: normalizeSelectValue(event.currentTarget.value) })
          }
          className="w-full rounded-md border border-slate-300 bg-transparent px-2 py-1 outline-none focus:border-sky-500 dark:border-slate-700"
        >
          {subtypeOptions.map((option) => (
            <option key={`${row.id}-subtype-${option}`} value={option}>
              {option}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
        {formatHex(row.offset)}
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
        <button
          type="button"
          onClick={() => onUpdateRow(row.id, { encrypted: !row.encrypted })}
          title={row.encrypted ? "Click to disable encryption" : "Click to enable encryption"}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${row.encrypted
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/45 dark:text-emerald-300"
            : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
            }`}
        >
          <FiShield />
          {row.encrypted ? "Encrypted" : "Off"}
        </button>
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
  onAddRow: () => void;
  onUpdateRow: (id: string, updates: Partial<PartitionDraftRow>) => void;
  onRequestDelete: (row: PartitionDraftRow) => void;
}

export default function PartitionTableCard({
  rows,
  flashBytes,
  onAddRow,
  onUpdateRow,
  onRequestDelete,
}: PartitionTableCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Partition Table Definition</h2>

        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <FiPlus /> Add Partition
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-280 border-collapse text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800/90">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Name</th>
              <th className="px-3 py-2 text-left font-semibold">Type</th>
              <th className="px-3 py-2 text-left font-semibold">Subtype</th>
              <th className="px-3 py-2 text-left font-semibold">Offset</th>
              <th className="px-3 py-2 text-left font-semibold">Size</th>
              <th className="px-3 py-2 text-left font-semibold">Hex</th>
              <th className="px-3 py-2 text-left font-semibold">Flags</th>
              <th className="px-3 py-2 text-center font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <PartitionRow
                key={row.id}
                row={row}
                maxBytes={maxSizeBytesForRow(rows, index, flashBytes)}
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
