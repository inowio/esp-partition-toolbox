interface PartitionPreviewCardProps {
  csv: string;
}

/**
 * Read-only view of the exact partition CSV that Save / Export writes to disk,
 * including the comment lines. Updates live as the table is edited.
 */
export default function PartitionPreviewCard({ csv }: PartitionPreviewCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3">
        <h2 className="text-base font-semibold">Partition Preview</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          The exact CSV written to your partition file.
        </p>
      </div>

      <textarea
        value={csv}
        readOnly
        rows={9}
        aria-label="Partition CSV preview"
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
      />
    </section>
  );
}
