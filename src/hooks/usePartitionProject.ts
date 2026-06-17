import { useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  ConfigTarget,
  LoadProjectResponse,
  PartitionDraftRow,
  PartitionLayoutResult,
  Platform,
  SaveProjectResponse,
  ToastMessage,
  ValidationError,
} from "../types";
import {
  calculateLayout,
  createEmptyRow,
  defaultRowsForFlashSize,
  inferFlashSizeMb,
  parsePartitionCsv,
  serializePartitionCsvForFlash,
} from "../utils/partition";
import { buildConfigPreview } from "../utils/configPreview";
import { platformLabel } from "../constants/platformOptions";

interface ProjectSnapshot {
  comments: string;
  rows: PartitionDraftRow[];
  flashSizeMb: number;
  partitionFilename: string;
  partitionOffset: string;
  sdkconfigFile: string;
}

interface CloseConfirmState {
  open: boolean;
}

const TOAST_TIMEOUT_MS = 5000;

function fallbackCopyText(text: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  document.body.removeChild(textarea);
  return copied;
}

function cloneRows(rows: PartitionDraftRow[]): PartitionDraftRow[] {
  return rows.map((row) => ({ ...row }));
}

export interface PartitionProjectState {
  isBusy: boolean;
  platform: Platform;
  mcu: string | null;
  projectPath: string;
  sdkconfigFile: string;
  configTargets: ConfigTarget[];
  configUpdatable: boolean;
  syncSdkconfig: boolean;
  partitionFilename: string;
  partitionOffset: string;
  flashSizeMb: number;
  comments: string;
  rows: PartitionDraftRow[];
  statusMessage: string;
  runtimeErrors: ValidationError[];
  rowPendingDelete: PartitionDraftRow | null;
  layout: PartitionLayoutResult;
  allErrors: ValidationError[];
  hasSnapshot: boolean;
  hasUnsavedChanges: boolean;
  closeConfirmOpen: boolean;
  toasts: ToastMessage[];
  partitionInfoText: string;
  partitionCsvText: string;
}

export interface PartitionProjectActions {
  setPlatform: (value: Platform) => void;
  changePlatform: (value: Platform) => Promise<void>;
  setMcu: (value: string | null) => void;
  setFlashSizeMb: (value: number) => void;
  setComments: (value: string) => void;
  setRowPendingDelete: (row: PartitionDraftRow | null) => void;
  setSdkconfigFile: (value: string) => void;
  setSyncSdkconfig: (value: boolean) => void;
  setPartitionOffset: (value: string) => void;
  loadProject: (forcePlatform?: Platform) => Promise<void>;
  saveProject: () => Promise<void>;
  closeProject: () => void;
  confirmCloseProject: () => void;
  cancelCloseProject: () => void;
  resetToSnapshot: () => void;
  updateRow: (id: string, updates: Partial<PartitionDraftRow>) => void;
  addRow: () => void;
  confirmDeleteRow: () => void;
  dismissToast: (id: string) => void;
  copyPartitionInfo: () => Promise<void>;
  copyPartitionCsv: () => Promise<void>;
}

function usePartitionProject(): PartitionProjectState & PartitionProjectActions {
  const [isBusy, setIsBusy] = useState(false);

  const [platform, setPlatform] = useState<Platform>("esp-idf");
  const [mcu, setMcu] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState("");
  const [sdkconfigFile, setSdkconfigFile] = useState("");
  const [configTargets, setConfigTargets] = useState<ConfigTarget[]>([]);
  const [configUpdatable, setConfigUpdatable] = useState(false);
  const [syncSdkconfig, setSyncSdkconfigState] = useState(false);
  const [partitionFilename, setPartitionFilename] = useState("partitions.csv");
  const [partitionOffset, setPartitionOffset] = useState("0x8000");

  const defaultFlash = 2;
  const initialRows = defaultRowsForFlashSize(defaultFlash);
  const [flashSizeMb, setFlashSizeMb] = useState(defaultFlash);
  const [comments, setComments] = useState("");
  const [rows, setRows] = useState<PartitionDraftRow[]>(initialRows);
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);

  const [statusMessage, setStatusMessage] = useState("Select a project folder to begin.");
  const [runtimeErrors, setRuntimeErrors] = useState<ValidationError[]>([]);
  const [rowPendingDelete, setRowPendingDelete] = useState<PartitionDraftRow | null>(null);
  const [closeConfirm, setCloseConfirm] = useState<CloseConfirmState>({ open: false });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const layout = useMemo(
    () => calculateLayout(rows, flashSizeMb, partitionOffset),
    [rows, flashSizeMb, partitionOffset],
  );
  const allErrors = useMemo<ValidationError[]>(
    () => [...runtimeErrors, ...layout.errors],
    [runtimeErrors, layout.errors],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!snapshot) {
      return projectPath.length > 0;
    }

    if (comments !== snapshot.comments) {
      return true;
    }

    if (flashSizeMb !== snapshot.flashSizeMb) {
      return true;
    }

    if (partitionFilename !== snapshot.partitionFilename) {
      return true;
    }

    if (partitionOffset !== snapshot.partitionOffset) {
      return true;
    }

    if (sdkconfigFile !== snapshot.sdkconfigFile) {
      return true;
    }

    if (rows.length !== snapshot.rows.length) {
      return true;
    }

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const snapshotRow = snapshot.rows[index];
      if (!snapshotRow) return true;

      if (
        row.name !== snapshotRow.name
        || row.type !== snapshotRow.type
        || row.subtype !== snapshotRow.subtype
        || row.size !== snapshotRow.size
        || row.pinnedOffset !== snapshotRow.pinnedOffset
        || row.encrypted !== snapshotRow.encrypted
        || row.readonly !== snapshotRow.readonly
      ) {
        return true;
      }
    }

    return false;
  }, [comments, flashSizeMb, partitionFilename, partitionOffset, projectPath, rows, sdkconfigFile, snapshot]);

  const partitionInfoText = useMemo(
    () => buildConfigPreview(platform, { partitionFilename, partitionOffset }),
    [platform, partitionFilename, partitionOffset],
  );

  // The exact CSV that saveProject would write — kept in sync for the preview.
  const partitionCsvText = useMemo(
    () => serializePartitionCsvForFlash(comments, layout.rows, flashSizeMb),
    [comments, layout.rows, flashSizeMb],
  );

  function pushToast(message: string, kind: ToastMessage["kind"]): void {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, message, kind }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_TIMEOUT_MS);
  }

  function dismissToast(id: string): void {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function setSyncSdkconfig(value: boolean): void {
    setSyncSdkconfigState(value);
    pushToast(
      value
        ? "Config sync enabled. Saves will also update the platform config file."
        : "Config sync disabled. Saves will only update the partition CSV.",
      value ? "info" : "warning",
    );
  }

  // Shared copy path: the Tauri clipboard plugin first (Rust backend, no
  // WebView permission prompt), then a legacy fallback for the dev server.
  async function copyToClipboard(text: string, successMessage: string): Promise<void> {
    try {
      await writeText(text);
      pushToast(successMessage, "success");
      return;
    } catch {
      // Fall through to the legacy copy path (e.g. browser-only dev server).
    }

    if (fallbackCopyText(text)) {
      pushToast(successMessage, "success");
      return;
    }

    pushToast("Clipboard is unavailable. Select the text and copy it manually.", "warning");
  }

  async function copyPartitionInfo(): Promise<void> {
    await copyToClipboard(partitionInfoText, "Config snippet copied to clipboard.");
  }

  async function copyPartitionCsv(): Promise<void> {
    await copyToClipboard(partitionCsvText, "Partition CSV copied to clipboard.");
  }

  function hydrateProjectState(response: LoadProjectResponse): void {
    // Prefer the flash size detected from sdkconfig; fall back to inferring
    // it from the partition table content when a file exists; otherwise keep
    // the value already in the UI.
    const inferredFlashSizeMb =
      response.flashSizeMb ??
      (response.partitionFileExists
        ? inferFlashSizeMb(response.partitionContent, response.partitionOffset)
        : null);
    const effectiveFlashSizeMb = inferredFlashSizeMb ?? flashSizeMb;
    const parsed = parsePartitionCsv(response.partitionContent, effectiveFlashSizeMb);
    const nextRows = parsed.rows.length > 0 ? parsed.rows : defaultRowsForFlashSize(effectiveFlashSizeMb);

    setPlatform(response.platform);
    setMcu(response.mcu);
    setProjectPath(response.projectPath);
    setSdkconfigFile(response.sdkconfigFile);
    setConfigTargets(response.configTargets);
    setConfigUpdatable(response.configUpdatable);
    setPartitionFilename(response.partitionFilename);
    setPartitionOffset(response.partitionOffset);
    setComments(parsed.comments);
    setRows(nextRows);
    setRuntimeErrors(parsed.errors.length > 0 ? parsed.errors : []);
    if (response.flashSizeMb != null) {
      setFlashSizeMb(response.flashSizeMb);
    } else if (inferredFlashSizeMb != null) {
      setFlashSizeMb(inferredFlashSizeMb);
    }

    if (response.flashSizeMb == null && inferredFlashSizeMb != null) {
      pushToast(
        `Flash size set to ${inferredFlashSizeMb} MB (inferred from the partition table; not declared in config).`,
        "info",
      );
    }

    setSnapshot({
      comments: parsed.comments,
      rows: cloneRows(nextRows),
      flashSizeMb: effectiveFlashSizeMb,
      partitionFilename: response.partitionFilename,
      partitionOffset: response.partitionOffset,
      sdkconfigFile: response.sdkconfigFile,
    });
    setCloseConfirm({ open: false });

    if (response.warnings.length > 0) {
      pushToast(response.warnings.join(" "), "warning");
    }

    const updateNotes: string[] = [];
    if (!response.partitionFileExists) {
      updateNotes.push(`${response.partitionFilename} not found; using in-memory defaults until you save`);
    }

    if (updateNotes.length > 0) {
      pushToast(`Project loaded. ${updateNotes.join(", ")}.`, "info");
      setStatusMessage("");
    } else {
      setStatusMessage("");
    }
  }

  async function loadProject(forcePlatform?: Platform): Promise<void> {
    setRuntimeErrors([]);

    if (!isTauri()) {
      setRuntimeErrors([
        { message: "Folder picker is available only in Tauri runtime. Start the app with `npx tauri dev`.", severity: "blocking" },
      ]);
      setStatusMessage("Run the desktop app to open native folder dialog.");
      return;
    }

    let selected: string | string[] | null = null;
    try {
      selected = await open({
        directory: true,
        multiple: false,
        title: `Select ${platformLabel(platform)} project folder`,
      });
    } catch (error) {
      setRuntimeErrors([{ message: `Failed to open folder dialog: ${String(error)}`, severity: "blocking" }]);
      setStatusMessage("Folder picker failed to open.");
      return;
    }

    if (typeof selected !== "string") {
      return;
    }

    setIsBusy(true);
    try {
      const response = await invoke<LoadProjectResponse>("load_project", {
        projectPath: selected,
        flashSizeMb,
        forcePlatform: forcePlatform ?? null,
      });

      hydrateProjectState(response);
    } catch (error) {
      setRuntimeErrors([{ message: String(error), severity: "blocking" }]);
      setStatusMessage("Failed to load project.");
    } finally {
      setIsBusy(false);
    }
  }

  // The Platform dropdown re-interprets the ALREADY-LOADED folder as the chosen
  // platform — no folder picker. When no project is loaded yet, it just sets the
  // platform used for the next Load. If the folder isn't that platform (its
  // config file is missing) the backend errors; we keep the current platform
  // (the controlled <select> reverts) and explain, instead of blocking.
  async function changePlatform(next: Platform): Promise<void> {
    if (!projectPath) {
      setPlatform(next);
      return;
    }
    if (next === platform) {
      return;
    }

    setIsBusy(true);
    try {
      const response = await invoke<LoadProjectResponse>("load_project", {
        projectPath,
        flashSizeMb,
        forcePlatform: next,
      });
      hydrateProjectState(response);
    } catch (error) {
      pushToast(
        `This folder isn't a ${platformLabel(next)} project — keeping ${platformLabel(platform)}. (${String(error)})`,
        "warning",
      );
    } finally {
      setIsBusy(false);
    }
  }

  function doCloseProject(): void {
    const defaults = defaultRowsForFlashSize(defaultFlash);

    setPlatform("esp-idf");
    setMcu(null);
    setProjectPath("");
    setSdkconfigFile("");
    setConfigTargets([]);
    setConfigUpdatable(false);
    setPartitionFilename("partitions.csv");
    setPartitionOffset("0x8000");
    setFlashSizeMb(defaultFlash);
    setComments("");
    setRows(defaults);
    setRuntimeErrors([]);
    setRowPendingDelete(null);
    setSnapshot(null);
    setCloseConfirm({ open: false });
    setStatusMessage("Project closed.");
  }

  function closeProject(): void {
    if (projectPath && hasUnsavedChanges) {
      setCloseConfirm({ open: true });
      return;
    }

    doCloseProject();
  }

  function confirmCloseProject(): void {
    doCloseProject();
  }

  function cancelCloseProject(): void {
    setCloseConfirm({ open: false });
  }

  function resetToSnapshot(): void {
    if (!snapshot) {
      setFlashSizeMb(defaultFlash);
      setComments("");
      setRows(defaultRowsForFlashSize(defaultFlash));
      setPartitionFilename("partitions.csv");
      setSdkconfigFile("");
      setRuntimeErrors([]);
      setStatusMessage("Reset to default partition layout.");
      return;
    }

    setComments(snapshot.comments);
    setRows(cloneRows(snapshot.rows));
    setFlashSizeMb(snapshot.flashSizeMb);
    setPartitionFilename(snapshot.partitionFilename);
    setPartitionOffset(snapshot.partitionOffset);
    setSdkconfigFile(snapshot.sdkconfigFile);
    setRuntimeErrors([]);
    setStatusMessage(
      projectPath ? "Changes reverted to last loaded state." : "Reset to default partition layout.",
    );
  }

  async function saveProject(): Promise<void> {
    if (!projectPath) {
      return;
    }

    const blockingErrors = allErrors.filter((error) => error.severity === "blocking");

    if (blockingErrors.length > 0) {
      setStatusMessage("Fix validation errors before saving.");
      return;
    }

    setIsBusy(true);
    setRuntimeErrors([]);

    try {
      const partitionContent = serializePartitionCsvForFlash(comments, layout.rows, flashSizeMb);

      const response = await invoke<SaveProjectResponse>("save_project", {
        request: {
          platform,
          projectPath,
          partitionFilename,
          partitionContent,
          partitionOffset,
          applyConfigUpdate: syncSdkconfig,
          configTargets: sdkconfigFile ? [sdkconfigFile] : [],
        },
      });

      // Snapshot from the rows we actually serialized and wrote, re-parsed from
      // the exact CSV sent to the backend. This keeps the snapshot in lockstep
      // with what's on disk so hasUnsavedChanges is false immediately after save.
      const savedRows = parsePartitionCsv(partitionContent, flashSizeMb).rows;
      setRows(savedRows);
      setSnapshot({
        comments,
        rows: cloneRows(savedRows),
        flashSizeMb,
        partitionFilename,
        partitionOffset,
        sdkconfigFile,
      });
      setCloseConfirm({ open: false });

      if (response.warnings.length > 0) {
        pushToast(response.warnings.join(" "), "warning");
      }

      pushToast(`Saved to ${response.partitionFilePath}`, "success");
      setStatusMessage("");
    } catch (error) {
      setRuntimeErrors([{ message: String(error), severity: "blocking" }]);
      setStatusMessage("Save failed.");
    } finally {
      setIsBusy(false);
    }
  }

  function updateRow(id: string, updates: Partial<PartitionDraftRow>): void {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, ...updates } : row)),
    );
  }

  function addRow(): void {
    setRows((currentRows) => [...currentRows, createEmptyRow()]);
  }

  function confirmDeleteRow(): void {
    if (!rowPendingDelete) {
      return;
    }

    setRows((currentRows) => currentRows.filter((row) => row.id !== rowPendingDelete.id));
    setRowPendingDelete(null);
  }

  return {
    isBusy,
    platform,
    mcu,
    projectPath,
    sdkconfigFile,
    configTargets,
    configUpdatable,
    syncSdkconfig,
    partitionFilename,
    partitionOffset,
    flashSizeMb,
    comments,
    rows,
    statusMessage,
    runtimeErrors,
    rowPendingDelete,
    layout,
    allErrors,
    hasSnapshot: snapshot !== null,
    hasUnsavedChanges,
    closeConfirmOpen: closeConfirm.open,
    toasts,
    partitionInfoText,
    partitionCsvText,
    setPlatform,
    changePlatform,
    setMcu,
    setFlashSizeMb,
    setSdkconfigFile,
    setSyncSdkconfig,
    setComments,
    setRowPendingDelete,
    loadProject,
    saveProject,
    closeProject,
    confirmCloseProject,
    cancelCloseProject,
    resetToSnapshot,
    updateRow,
    addRow,
    confirmDeleteRow,
    dismissToast,
    copyPartitionInfo,
    copyPartitionCsv,
    setPartitionOffset,
  };
}

export default usePartitionProject;
