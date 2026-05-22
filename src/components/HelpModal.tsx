import { FiX } from "react-icons/fi";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

interface HelpStep {
  title: string;
  body: string;
}

const STEPS: HelpStep[] = [
  {
    title: "1. Load your ESP-IDF project",
    body: "Click Load Project and pick the project folder — the one containing CMakeLists.txt and an sdkconfig.defaults file. The tool reads your existing partition CSV (or generates a sensible default) and detects the partition table offset.",
  },
  {
    title: "2. Set the flash size",
    body: "Choose the flash size of your ESP chip from the Flash Size dropdown. Every limit, the visual map, and the free-space figures update to match.",
  },
  {
    title: "3. Edit the partition table",
    body: "Use Add Partition to append a row, then set its name, type, and subtype. Resize with the number field, the unit selector, the drag slider, or the fill button which expands a partition into all the space available to it. Remove a row with the trash icon.",
  },
  {
    title: "4. Read the visual map",
    body: "Reserved is the space the bootloader and partition table occupy before your first partition. Coloured segments are your partitions; Free is unallocated flash. App-type partitions must start on a 64 KB boundary, so small alignment gaps are normal.",
  },
  {
    title: "5. Watch the validation panel",
    body: "The Validation card flags overlaps, misaligned offsets, partitions past the flash boundary, duplicate names, and missing required partitions. Clear every error before flashing the device.",
  },
  {
    title: "6. Save or copy the result",
    body: "Save / Export writes the partition CSV back to your project and keeps the sdkconfig partition entries in sync. You can also copy the CSV from Partition Preview, or the sdkconfig lines from Entry for sdkconfig, and paste them in manually.",
  },
];

export default function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) {
    return <></>;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 px-4 py-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How to use ESP Partition Toolbox"
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold">How to use this tool</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Build a valid ESP-IDF partition table in six steps
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 p-1.5 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ol className="space-y-4">
            {STEPS.map((step) => (
              <li key={step.title}>
                <h3 className="text-sm font-semibold text-sky-700 dark:text-sky-300">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Tip:</span>{" "}
            Right-click any text field for cut, copy, paste, and select-all. The
            partition CSV and sdkconfig entries always reflect your latest edits.
          </div>
        </div>
      </div>
    </div>
  );
}
