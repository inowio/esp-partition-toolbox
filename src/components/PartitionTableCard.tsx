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
  parseSizeString,
} from "../utils/partition";
import type { SizeUnit } from "../utils/partition";

const SLIDER_MIN_BYTES = 4 * 1024;
const SLIDER_RESOLUTION = 500;

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
  if (bytes <= SLIDER_MIN_BYTES) return 0;
  if (bytes >= maxBytes) return SLIDER_RESOLUTION;

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

interface PartitionTableCardProps {
  rows: PartitionLayoutRow[];
  flashBytes: number;
  freeBytes: number;
  onAddRow: () => void;
  onUpdateRow: (id: string, updates: Partial<PartitionDraftRow>) => void;
  onRequestDelete: (row: PartitionDraftRow) => void;
}

function normalizeSelectValue(value: string): string {
  return value.trim().toLowerCase();
}

export default function PartitionTableCard({
  rows,
  flashBytes,
  freeBytes,
  onAddRow,
  onUpdateRow,
  onRequestDelete,
}: PartitionTableCardProps) {
  const canFill = freeBytes > 0;

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
            {rows.map((row) => {
              const normalizedType = normalizeSelectValue(row.type) || "data";
              const normalizedSubtype = normalizeSelectValue(row.subtype);
              const typeOptions = withCurrentOption(PARTITION_TYPE_OPTIONS, normalizedType);
              const subtypeOptions = withCurrentOption(
                getSubtypeOptionsForType(normalizedType),
                normalizedSubtype,
              );
              const { value: sizeValue, unit: sizeUnit } = parseSizeString(row.size);

              // A partition can never grow past the flash boundary: its ceiling
              // is the span from its own offset to the end of flash.
              const rowMaxBytes = Math.max(flashBytes - row.offset, SLIDER_MIN_BYTES);
              const maxValueInUnit = maxValueForUnit(rowMaxBytes, sizeUnit);

              return (
                <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700">
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
                          // Never accept a size that would cross the flash boundary.
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
                          const clamped = Math.min(converted, maxValueForUnit(rowMaxBytes, nextUnit));
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
                          onUpdateRow(row.id, {
                            size: formatSizeToPartitionUnit(row.sizeBytes + freeBytes),
                          })
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
                      value={bytesToSliderPosition(row.sizeBytes || SLIDER_MIN_BYTES, rowMaxBytes)}
                      onChange={(event) => {
                        const bytes = sliderPositionToBytes(Number(event.currentTarget.value), rowMaxBytes);
                        const converted = convertSizeUnit(bytes, "B", sizeUnit);
                        const clamped = Math.min(converted, maxValueInUnit);
                        onUpdateRow(row.id, { size: composeSizeString(clamped, sizeUnit) });
                      }}
                      className="size-slider mt-1.5"
                      title={`Drag to resize (4K — ${formatSizeToPartitionUnit(rowMaxBytes)})`}
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
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
