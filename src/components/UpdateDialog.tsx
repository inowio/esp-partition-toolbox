import { useState } from "react";
import { FiDownload, FiRefreshCcw, FiX } from "react-icons/fi";

import type { ProgressHandler } from "../api/updater";

interface UpdateDialogProps {
  open: boolean;
  version: string;
  currentVersion: string;
  notes: string | null;
  install: (onProgress: ProgressHandler) => Promise<void>;
  onClose: () => void;
}

type Phase =
  | { kind: "idle" }
  | { kind: "downloading"; downloaded: number; total: number | null }
  | { kind: "error"; message: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function UpdateDialog({
  open,
  version,
  currentVersion,
  notes,
  install,
  onClose,
}: UpdateDialogProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  if (!open) {
    return <></>;
  }

  const busy = phase.kind === "downloading";

  function requestClose(): void {
    if (busy) return;
    setPhase({ kind: "idle" });
    onClose();
  }

  async function handleInstall(): Promise<void> {
    setPhase({ kind: "downloading", downloaded: 0, total: null });
    try {
      await install((downloaded, total) => {
        setPhase({ kind: "downloading", downloaded, total });
      });
      // On success the app relaunches, so this state is rarely visible.
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  const progressPercent =
    phase.kind === "downloading" && phase.total
      ? Math.min(100, Math.round((phase.downloaded / phase.total) * 100))
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Update available"
        className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              Update available
            </div>
            <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Version {version} is available. You have {currentVersion}.
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={requestClose}
            disabled={busy}
            title="Close"
            aria-label="Close"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>

        {phase.kind === "error" ? (
          <div className="mt-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-800 dark:text-rose-200">
            Update failed: {phase.message}
          </div>
        ) : null}

        <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
          {notes ? (
            <pre className="whitespace-pre-wrap font-sans">{notes}</pre>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">
              No release notes provided.
            </span>
          )}
        </div>

        {phase.kind === "downloading" ? (
          <div className="mt-3" aria-live="polite">
            <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200">
              <span className="inline-flex items-center gap-2">
                <FiRefreshCcw className="h-3 w-3 animate-spin" aria-hidden="true" />
                Downloading…
              </span>
              <span>
                {formatBytes(phase.downloaded)}
                {phase.total ? ` / ${formatBytes(phase.total)}` : ""}
                {progressPercent !== null ? ` (${progressPercent}%)` : ""}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: progressPercent !== null ? `${progressPercent}%` : "30%" }}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2 text-xs">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={requestClose}
            disabled={busy}
          >
            Later
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleInstall}
            disabled={busy}
          >
            <FiDownload className="h-3 w-3" aria-hidden="true" />
            {phase.kind === "error" ? "Retry" : "Install"}
          </button>
        </div>
      </div>
    </div>
  );
}
