import { FiCopy } from "react-icons/fi";

interface PartitionInformationCardProps {
  partitionInfo: string;
  onCopy: () => void | Promise<void>;
  isBusy: boolean;
}

export default function PartitionInformationCard({
  partitionInfo,
  onCopy,
  isBusy,
}: PartitionInformationCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Entry for sdkconfig</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Copy these entries into your sdkconfig to set the partition table.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void onCopy()}
          disabled={isBusy}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <FiCopy />
          Copy
        </button>
      </div>

      <textarea
        value={partitionInfo}
        readOnly
        rows={9}
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
      />
    </section>
  );
}
