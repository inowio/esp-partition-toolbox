import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiFolder, FiRotateCcw, FiSave, FiXCircle } from "react-icons/fi";

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
  onFlashSizeChange: (value: number) => void;
  onSdkconfigFileChange: (value: string) => void;
  onSyncSdkconfigChange: (value: boolean) => void;
  onLoad: () => void;
  onSave: () => void;
  onClose: () => void;
  onReset: () => void;
  onPartitionOffsetChange: (value: string) => void;
}

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
  onFlashSizeChange,
  onSdkconfigFileChange,
  onSyncSdkconfigChange,
  onLoad,
  onSave,
  onClose,
  onReset,
  onPartitionOffsetChange,
}: ProjectHeaderCardProps) {
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

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            {projectPath && (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800/60">
                <span className="font-semibold">Partition File:</span>{" "}
                {partitionFilename}
              </span>
            )}
            <label
              ref={presetsRef}
              className="relative flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800/60"
              title="Partition table offset (CONFIG_PARTITION_TABLE_OFFSET). Most projects use 0x8000; some configs need 0x9000 or higher."
            >
              <span className="font-semibold">Partition Start:</span>
              <input
                value={partitionOffset}
                onChange={(event) => onPartitionOffsetChange(event.currentTarget.value)}
                aria-label="Partition table offset"
                placeholder="0x8000"
                className={`w-20 rounded border bg-transparent px-1.5 py-0.5 font-mono text-[11px] outline-none focus:border-sky-500 ${
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
                className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FiChevronDown className="h-3 w-3" aria-hidden="true" />
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
                      <div className="font-mono text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                        {preset.value}
                      </div>
                      {preset.label && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {preset.label}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </label>
          </div>
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
              title="Export / Save to partition (csv) file"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              <FiSave />
              Save / Export
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
              disabled={isBusy}
              title="Discard changes — restore the last loaded project, or the default layout if none is loaded"
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
