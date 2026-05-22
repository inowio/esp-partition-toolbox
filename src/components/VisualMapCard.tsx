import type { PartitionLayoutRow } from "../types";
import { formatBytes, formatHex } from "../utils/partition";

interface VisualMapCardProps {
  rows: PartitionLayoutRow[];
  flashBytes: number;
  reservedBytes: number;
}

const PALETTE = [
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-orange-500",
];

const MIN_LABEL_PERCENT = 5;

export default function VisualMapCard({ rows, flashBytes, reservedBytes }: VisualMapCardProps) {
  // Use flex-grow proportional to byte spans so segments always total exactly 100%.
  // Alignment gaps are absorbed into each partition's visual width.
  const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
  const freeBytes = lastRow ? Math.max(flashBytes - lastRow.end, 0) : 0;
  const reservedSpan = rows.length > 0 ? rows[0].offset : 0;

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-base font-semibold">Partition Visual Map</h2>

      <div className="flex min-h-14 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        {rows.length === 0 && (
          <div className="flex w-full items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-800/70 dark:text-slate-300">
            No partitions to visualize
          </div>
        )}

        {rows.length > 0 && reservedSpan > 0 && (
          <div
            className="flex flex-col items-center justify-center overflow-hidden border-r border-white/20 bg-slate-400 dark:bg-slate-600"
            style={{ flex: `${reservedSpan} 0 0px`, minWidth: 14 }}
            title={`Reserved (bootloader + partition table)\n${formatBytes(reservedBytes)}`}
          >
            {(reservedSpan / flashBytes) * 100 >= MIN_LABEL_PERCENT && (
              <span className="pointer-events-none text-[10px] font-medium text-white/80">
                Reserved
              </span>
            )}
          </div>
        )}

        {rows.map((row, index) => {
          // Each partition spans from its offset to the next partition's offset (or its own end for the last).
          // This absorbs alignment gaps into the partition's visual width.
          const spanEnd = index < rows.length - 1 ? rows[index + 1].offset : row.end;
          const span = spanEnd - row.offset;
          const rawPercent = flashBytes > 0 ? (row.sizeBytes / flashBytes) * 100 : 0;
          const showLabel = rawPercent >= MIN_LABEL_PERCENT;

          return (
            <div
              key={row.id}
              className={`group relative flex flex-col items-center justify-center overflow-hidden border-r border-white/20 last:border-r-0 ${PALETTE[index % PALETTE.length]}`}
              style={{ flex: `${span} 0 0px`, minWidth: 14 }}
              title={`${row.name} (${row.type}/${row.subtype})\nOffset: ${formatHex(row.offset)}\nSize: ${row.size} (${formatBytes(row.sizeBytes)}) [${formatHex(row.sizeBytes)}]`}
            >
              {showLabel ? (
                <>
                  <span className="pointer-events-none max-w-full truncate px-1 text-[11px] font-bold text-white">
                    {row.name}
                  </span>
                  <span className="pointer-events-none max-w-full truncate px-1 text-[9px] text-white/70">
                    {row.size}
                  </span>
                </>
              ) : (
                <span className="pointer-events-none h-2 w-2 rounded-full bg-white/80" />
              )}
            </div>
          );
        })}

        {rows.length > 0 && freeBytes > 0 && (
          <div
            className="flex flex-col items-center justify-center bg-slate-200 dark:bg-slate-700/50"
            style={{ flex: `${freeBytes} 0 0px` }}
            title={`Free\n${formatBytes(freeBytes)}`}
          >
            {(freeBytes / flashBytes) * 100 >= MIN_LABEL_PERCENT && (
              <span className="pointer-events-none text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Free
              </span>
            )}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {rows.map((row, index) => (
            <div key={row.id} className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-400">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${PALETTE[index % PALETTE.length]}`} />
              <span className="font-medium">{row.name}</span>
              <span className="text-slate-400 dark:text-slate-500">({row.size})</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
