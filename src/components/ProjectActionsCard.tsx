import { FiFolder, FiRotateCcw, FiSave, FiXCircle } from "react-icons/fi";
import type { Platform } from "../types";
import { platformLabel } from "../constants/platformOptions";

interface ProjectActionsCardProps {
  projectPath: string;
  platform: Platform;
  statusMessage: string;
  isBusy: boolean;
  onLoad: () => void;
  onSave: () => void;
  onClose: () => void;
  onReset: () => void;
}

export default function ProjectActionsCard({
  projectPath, platform, statusMessage, isBusy, onLoad, onSave, onClose, onReset,
}: ProjectActionsCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onLoad} disabled={isBusy} title="Load project folder"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60">
            <FiFolder /> Load Project
          </button>
          <button type="button" onClick={onSave} disabled={!projectPath || isBusy} title="Export / save the partition CSV"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">
            <FiSave /> Save / Export
          </button>
          <button type="button" onClick={onClose} disabled={!projectPath || isBusy} title="Close this project"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-60">
            <FiXCircle /> Close
          </button>
          <button type="button" onClick={onReset} disabled={isBusy} title="Discard changes — restore last loaded / defaults"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-60">
            <FiRotateCcw /> Reset
          </button>
        </div>

        <div className="min-w-0 flex-1 lg:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Project Folder</p>
          {projectPath ? (
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300">
                {platformLabel(platform)}
              </span>
              <span className="break-all text-sm font-medium text-slate-800 dark:text-slate-200">{projectPath}</span>
            </div>
          ) : (
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              No project selected — click <span className="font-semibold text-sky-600 dark:text-sky-400">Load</span> to open a project folder.
            </p>
          )}
          {statusMessage && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{statusMessage}</p>}
        </div>
      </div>
    </section>
  );
}
