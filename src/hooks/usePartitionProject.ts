import { useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  LoadProjectResponse,
  PartitionDraftRow,
  PartitionLayoutResult,
  SaveProjectResponse,
  ToastMessage,
  ValidationError,
} from "../types";
import {
  calculateLayout,
  createEmptyRow,
  defaultRowsForFlashSize,
  parsePartitionCsv,
  serializePartitionCsvForFlash,
} from "../utils/partition";

interface ProjectSnapshot {
  comments: string;
  rows: PartitionDraftRow[];
  flashSizeMb: number;
  partitionFilename: string;
  sdkconfigFile: string;
}

interface CloseConfirmState {
  open: boolean;
}

const TOAST_TIMEOUT_MS = 5000;

function buildPartitionInfoBlock(partitionFilename: string, partitionOffset: string): string {
  const safeFilename = (partitionFilename.trim() || "partitions.csv").replace(/"/g, '\\"');
  const safeOffset = partitionOffset.trim() || "0x8000";

  return [
    "#",
    "# Partition Table",
    "#",
    "CONFIG_PARTITION_TABLE_CUSTOM=y",
    `CONFIG_PARTITION_TABLE_CUSTOM_FILENAME=\"${safeFilename}\"`,
    `CONFIG_PARTITION_TABLE_FILENAME=\"${safeFilename}\"`,
    `CONFIG_PARTITION_TABLE_OFFSET=${safeOffset}`,
    "CONFIG_PARTITION_TABLE_MD5=y",
    "# end of Partition Table",
  ].join("\n");
}

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
  projectPath: string;
  sdkconfigFile: string;
  sdkconfigFiles: string[];
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
  setFlashSizeMb: (value: number) => void;
  setComments: (value: string) => void;
  setRowPendingDelete: (row: PartitionDraftRow | null) => void;
  setSdkconfigFile: (value: string) => void;
  setSyncSdkconfig: (value: boolean) => void;
  loadProject: () => Promise<void>;
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

  const [projectPath, setProjectPath] = useState("");
  const [sdkconfigFile, setSdkconfigFile] = useState("");
  const [sdkconfigFiles, setSdkconfigFiles] = useState<string[]>([]);
  const [syncSdkconfig, setSyncSdkconfigState] = useState(false);
  const [partitionFilename, setPartitionFilename] = useState("partitions.csv");
  const [partitionOffset, setPartitionOffset] = useState("0x8000");

  const defaultFlash = 2;
  const initialRows = defaultRowsForFlashSize(defaultFlash);
  const [flashSizeMb, setFlashSizeMb] = useState(defaultFlash);
  const [comments, setComments] = useState("");
  const [rows, setRows] = useState<PartitionDraftRow[]>(initialRows);
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);

  const [statusMessage, setStatusMessage] = useState("Select an ESP-IDF project folder to begin.");
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
  }, [comments, flashSizeMb, partitionFilename, projectPath, rows, sdkconfigFile, snapshot]);

  const partitionInfoText = useMemo(
    () => buildPartitionInfoBlock(partitionFilename, partitionOffset),
    [partitionFilename, partitionOffset],
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
        ? "sdkconfig sync enabled. Saves will update sdkconfig partition entries."
        : "sdkconfig sync disabled. Saves will only update the partition CSV.",
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
    await copyToClipboard(partitionInfoText, "sdkconfig entries copied to clipboard.");
  }

  async function copyPartitionCsv(): Promise<void> {
    await copyToClipboard(partitionCsvText, "Partition CSV copied to clipboard.");
  }

  function hydrateProjectState(response: LoadProjectResponse): void {
    const parsed = parsePartitionCsv(response.partitionContent, flashSizeMb);
    const nextRows = parsed.rows.length > 0 ? parsed.rows : defaultRowsForFlashSize(flashSizeMb);

    setProjectPath(response.projectPath);
    setSdkconfigFile(response.sdkconfigFile);
    setSdkconfigFiles(response.sdkconfigFiles);
    setPartitionFilename(response.partitionFilename);
    setPartitionOffset(response.partitionOffset);
    setComments(parsed.comments);
    setRows(nextRows);
    setRuntimeErrors(parsed.errors.length > 0 ? parsed.errors : []);

    setSnapshot({
      comments: parsed.comments,
      rows: cloneRows(nextRows),
      flashSizeMb,
      partitionFilename: response.partitionFilename,
      sdkconfigFile: response.sdkconfigFile,
    });
    setCloseConfirm({ open: false });

    const updateNotes: string[] = [];
    if (response.sdkconfigUpdated) {
      updateNotes.push("sdkconfig partition block was added");
    }

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

  async function loadProject(): Promise<void> {
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
        title: "Select ESP-IDF Project Folder",
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
      const response = await invoke<LoadProjectResponse>("load_esp_project", {
        projectPath: selected,
        flashSizeMb,
        syncSdkconfig,
      });

      hydrateProjectState(response);
    } catch (error) {
      setRuntimeErrors([{ message: String(error), severity: "blocking" }]);
      setStatusMessage("Failed to load project.");
    } finally {
      setIsBusy(false);
    }
  }

  function doCloseProject(): void {
    const defaults = defaultRowsForFlashSize(defaultFlash);

    setProjectPath("");
    setSdkconfigFile("");
    setSdkconfigFiles([]);
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
      setSdkconfigFiles([]);
      setRuntimeErrors([]);
      setStatusMessage("Reset to default partition layout.");
      return;
    }

    setComments(snapshot.comments);
    setRows(cloneRows(snapshot.rows));
    setFlashSizeMb(snapshot.flashSizeMb);
    setPartitionFilename(snapshot.partitionFilename);
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

      const response = await invoke<SaveProjectResponse>("save_project_state", {
        request: {
          projectPath,
          sdkconfigFile,
          partitionFilename,
          partitionContent,
          syncSdkconfig,
        },
      });

      setSnapshot({
        comments,
        rows: cloneRows(rows),
        flashSizeMb,
        partitionFilename,
        sdkconfigFile,
      });
      setCloseConfirm({ open: false });

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
    projectPath,
    sdkconfigFile,
    sdkconfigFiles,
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
  };
}

export default usePartitionProject;
