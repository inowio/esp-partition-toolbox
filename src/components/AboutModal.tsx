import { useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiDownload,
  FiExternalLink,
  FiGithub,
  FiRefreshCcw,
  FiX,
} from "react-icons/fi";

import { openExternal } from "../api/openExternal";
import { checkForUpdate } from "../api/updater";
import type { UpdatePrompt } from "../api/updater";

const REPO_URL = "https://github.com/inowio/esp-partition-toolbox";
const RELEASES_URL = "https://github.com/inowio/esp-partition-toolbox/releases/latest";
const COMPANY_URL = "https://inowio.in";

const FEATURES = [
  "Auto-detects ESP-IDF, PlatformIO, and Arduino projects and reads the existing table",
  "Visually edit partition name, type, subtype, and size",
  "Real-time validation of alignment, boundaries, and duplicates",
  "Proportional flash-usage map with a total / allocated / free dashboard",
  "Writes the partition CSV and syncs the platform config (sdkconfig / platformio.ini / sketch.yaml)",
];

interface AboutModalProps {
  open: boolean;
  appVersion: string;
  onClose: () => void;
  onUpdateAvailable: (prompt: UpdatePrompt) => void;
}

type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "up-to-date" }
  | { kind: "error"; message: string };

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        void openExternal(href);
      }}
      className="inline-flex items-center gap-1 font-medium text-sky-700 transition hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300"
    >
      {children}
    </a>
  );
}

export default function AboutModal({
  open,
  appVersion,
  onClose,
  onUpdateAvailable,
}: AboutModalProps) {
  const [checkState, setCheckState] = useState<CheckState>({ kind: "idle" });

  // Forget the previous result every time the dialog is reopened.
  useEffect(() => {
    if (open) {
      setCheckState({ kind: "idle" });
    }
  }, [open]);

  if (!open) {
    return <></>;
  }

  async function handleCheck(): Promise<void> {
    setCheckState({ kind: "checking" });
    const result = await checkForUpdate();
    if (result.status === "available") {
      setCheckState({ kind: "idle" });
      onUpdateAvailable({
        version: result.version,
        currentVersion: result.currentVersion,
        notes: result.notes,
        update: result.update,
      });
    } else if (result.status === "up-to-date") {
      setCheckState({ kind: "up-to-date" });
    } else {
      setCheckState({ kind: "error", message: result.message });
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 px-4 py-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="About ESP Partition Toolbox"
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" className="h-10 w-10" alt="ESP Partition Toolbox logo" />
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                ESP Partition Toolbox
                <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300">
                  v{appVersion}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Desktop GUI for ESP32 partition tables
              </p>
            </div>
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
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            ESP Partition Toolbox loads an ESP-IDF, PlatformIO, or Arduino project
            folder and lets you edit its partition layout visually — validating ESP32
            rules as you go — then writes the result straight back to the partition
            CSV. No hand-editing a text file and no guesswork about offsets or
            alignment.
          </p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-sky-700 dark:text-sky-300">
              What you can do
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
              {FEATURES.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCheck}
              disabled={checkState.kind === "checking"}
              title="Check for updates"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRefreshCcw
                className={`h-3.5 w-3.5 ${checkState.kind === "checking" ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {checkState.kind === "checking" ? "Checking…" : "Check for updates"}
            </button>
            {checkState.kind === "up-to-date" ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                <FiCheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                You're on the latest version.
              </span>
            ) : null}
            {checkState.kind === "error" ? (
              <span
                className="inline-flex items-center gap-1 text-xs text-rose-700 dark:text-rose-300"
                title={checkState.message}
              >
                <FiAlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Could not check for updates.
              </span>
            ) : null}
          </div>

          <hr className="my-4 border-slate-200 dark:border-slate-800" />

          <dl className="grid gap-2 text-sm sm:grid-cols-[7rem_1fr]">
            <dt className="font-semibold text-slate-900 dark:text-slate-100">License</dt>
            <dd className="text-slate-700 dark:text-slate-300">MIT</dd>

            <dt className="font-semibold text-slate-900 dark:text-slate-100">Source</dt>
            <dd>
              <ExternalLink href={REPO_URL}>
                <FiGithub className="h-3.5 w-3.5" aria-hidden="true" />
                github.com/inowio/esp-partition-toolbox
              </ExternalLink>
            </dd>

            <dt className="font-semibold text-slate-900 dark:text-slate-100">Downloads</dt>
            <dd>
              <ExternalLink href={RELEASES_URL}>
                <FiDownload className="h-3.5 w-3.5" aria-hidden="true" />
                Latest release on GitHub
              </ExternalLink>
            </dd>
          </dl>

          <hr className="my-4 border-slate-200 dark:border-slate-800" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Theme-specific marks — the dark logo is white, invisible on
                  a light background, so each theme gets its own file. */}
              <img
                src="/inowio-logo-light.svg"
                alt="Inowio Technologies LLP logo"
                className="h-10 w-10 shrink-0 dark:hidden"
              />
              <img
                src="/inowio-logo-dark.svg"
                alt="Inowio Technologies LLP logo"
                className="hidden h-10 w-10 shrink-0 dark:block"
              />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Inowio Technologies LLP
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  From Bits to Machines
                </p>
              </div>
            </div>
            <ExternalLink href={COMPANY_URL}>
              <FiExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              inowio.in
            </ExternalLink>
          </div>
        </div>
      </div>
    </div>
  );
}
