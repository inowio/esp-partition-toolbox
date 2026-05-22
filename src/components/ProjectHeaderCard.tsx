import { FiFolder, FiRotateCcw, FiSave, FiXCircle } from "react-icons/fi";

interface ProjectHeaderCardProps {
  flashOptions: number[];
  flashSizeMb: number;
  projectPath: string;
  sdkconfigFile: string;
  sdkconfigFiles: string[];
  syncSdkconfig: boolean;
  partitionFilename: string;
  partitionOffset: string;
  statusMessage: string;
  isBusy: boolean;
  hasSnapshot: boolean;
  onFlashSizeChange: (value: number) => void;
  onSdkconfigFileChange: (value: string) => void;
  onSyncSdkconfigChange: (value: boolean) => void;
  onLoad: () => void;
  onSave: () => void;
  onClose: () => void;
  onReset: () => void;
}

function getSdkconfigDisplayName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const fileName = normalized.split("/").pop();
  return fileName || filePath;
}

export default function ProjectHeaderCard({
  flashOptions,
  flashSizeMb,
  projectPath,
  sdkconfigFile,
  sdkconfigFiles,
  syncSdkconfig,
  partitionFilename,
  partitionOffset,
  statusMessage,
  isBusy,
  hasSnapshot,
  onFlashSizeChange,
  onSdkconfigFileChange,
  onSyncSdkconfigChange,
  onLoad,
  onSave,
  onClose,
  onReset,
}: ProjectHeaderCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Project Folder
          </p>

          {projectPath ? (
            <p className="break-all text-sm font-medium text-slate-800 dark:text-slate-200">
              {projectPath}
            </p>
          ) : (
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              No project selected &mdash; click{" "}
              <span className="font-semibold text-sky-600 dark:text-sky-400">
                Load
              </span>{" "}
              to open an ESP-IDF project folder.
            </p>
          )}

          {statusMessage && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{statusMessage}</p>
          )}

          {projectPath && (
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800/60">
                <span className="font-semibold">Partition File:</span>{" "}
                {partitionFilename}
              </span>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800/60">
                <span className="font-semibold">Partition Start:</span>{" "}
                {partitionOffset}
              </span>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-auto lg:items-end">
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Flash Size
              </span>
              <select
                value={flashSizeMb}
                onChange={(event) =>
                  onFlashSizeChange(Number(event.currentTarget.value))
                }
                title="Select flash size"
                className="w-20 bg-transparent text-sm outline-none"
              >
                {flashOptions.map((size) => (
                  <option key={size} value={size}>
                    {size} MB
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={onLoad}
              disabled={isBusy}
              title="Load ESP-IDF Project"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
            >
              <FiFolder />
              Load Project
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={!projectPath || isBusy}
              title="Save to partition file"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              <FiSave />
              Save
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={!projectPath || isBusy}
              title="Close this project"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-60"
            >
              <FiXCircle />
              Close
            </button>

            <button
              type="button"
              onClick={onReset}
              disabled={!hasSnapshot || isBusy}
              title="Reset the partition last saved / defaults"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-60"
            >
              <FiRotateCcw />
              Reset
            </button>
          </div>

          {projectPath && (
            <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-slate-300 px-2.5 py-2 text-xs dark:border-slate-700 lg:w-auto">
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                Sync sdkconfig
              </span>

              <label
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                  syncSdkconfig
                    ? "bg-sky-600"
                    : "bg-slate-400 dark:bg-slate-600"
                } ${isBusy ? "opacity-70" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={syncSdkconfig}
                  disabled={isBusy}
                  onChange={(event) =>
                    onSyncSdkconfigChange(event.currentTarget.checked)
                  }
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  title="Enable or disable writing partition settings into sdkconfig files"
                />
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    syncSdkconfig ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </label>

              <span
                className={`text-[10px] font-semibold ${
                  syncSdkconfig
                    ? "text-emerald-600 dark:text-emerald-300"
                    : "text-amber-600 dark:text-amber-300"
                }`}
              >
                {syncSdkconfig ? "sync on" : "sync off"}
              </span>

              <select
                value={sdkconfigFile}
                onChange={(event) =>
                  onSdkconfigFileChange(event.currentTarget.value)
                }
                disabled={!syncSdkconfig || isBusy}
                title={
                  syncSdkconfig
                    ? "Select a sdkconfig file to save partition information"
                    : "Enable sdkconfig sync to choose a sdkconfig file"
                }
                className="min-w-36 max-w-56 rounded border border-slate-300 bg-transparent px-1.5 py-1 text-xs outline-none disabled:opacity-60 dark:border-slate-700"
              >
                {sdkconfigFiles.map((file) => (
                  <option key={file} value={file}>
                    {getSdkconfigDisplayName(file)}
                  </option>
                ))}
              </select>

              {!syncSdkconfig && (
                <span className="text-[10px] text-amber-600 dark:text-amber-300">
                  manual config update required
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
