import { formatBytes } from "../utils/partition";

interface KpiCardsProps {
  flashBytes: number;
  allocated: number;
  free: number;
  /** Usable flash = total − reserved. */
  usableBytes: number;
  reservedBytes: number;
}

export default function KpiCards({ flashBytes, allocated, free, usableBytes, reservedBytes }: KpiCardsProps) {
  const pct = (part: number) => (usableBytes > 0 ? Math.min((part / usableBytes) * 100, 100) : 0);
  const allocatedPercent = pct(allocated);
  const freePercent = pct(free);
  const usedBarPercent = flashBytes > 0 ? Math.min(((flashBytes - free) / flashBytes) * 100, 100) : 0;
  const usageColor =
    usedBarPercent > 90 ? "bg-rose-500" : usedBarPercent > 70 ? "bg-amber-500" : "bg-sky-500";

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Total Flash
        </p>
        <p className="mt-3 text-2xl font-bold">{formatBytes(flashBytes)}</p>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Allocated
        </p>
        <div className="mt-3 flex items-baseline gap-2">
          <p className="text-2xl font-bold text-sky-600 dark:text-sky-300">{formatBytes(allocated)}</p>
          <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">
            {allocatedPercent.toFixed(1)}%
          </span>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Free Space
        </p>
        <div className="mt-3 flex items-baseline gap-2">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{formatBytes(free)}</p>
          <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">
            {freePercent.toFixed(1)}%
          </span>
        </div>
        {reservedBytes > 0 && (
          <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
            {formatBytes(reservedBytes)} reserved for bootloader &amp; partition table
          </p>
        )}
      </article>

      <div className="md:col-span-3">
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className={`h-full rounded-full transition-all duration-300 ${usageColor}`}
            style={{ width: `${usedBarPercent}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
          <span>0%</span>
          <span>{usedBarPercent.toFixed(1)}% used</span>
          <span>100%</span>
        </div>
      </div>
    </section>
  );
}
