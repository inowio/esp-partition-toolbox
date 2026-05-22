import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoadProjectResponse } from "../types";

// Hoisted mocks so the module factories can reference them safely.
const { invokeMock, openMock, isTauriMock, writeTextMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  openMock: vi.fn(),
  isTauriMock: vi.fn(),
  writeTextMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: openMock,
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: writeTextMock,
}));

import usePartitionProject from "./usePartitionProject";

const LOAD_RESPONSE: LoadProjectResponse = {
  projectPath: "C:/dev/esp-project",
  sdkconfigFile: "C:/dev/esp-project/sdkconfig.defaults",
  sdkconfigFiles: ["C:/dev/esp-project/sdkconfig.defaults"],
  partitionFilename: "partitions.csv",
  partitionFilePath: "C:/dev/esp-project/partitions.csv",
  partitionContent: [
    "nvs, data, nvs, 0x10000, 16K,",
    "phy_init, data, phy, 0x14000, 4K,",
    "factory, app, factory, 0x20000, 1920K,",
    "",
  ].join("\n"),
  partitionFileExists: true,
  sdkconfigUpdated: false,
  partitionOffset: "0x8000",
};

function mockInvokeRouting() {
  invokeMock.mockImplementation((command: string) => {
    if (command === "load_esp_project") {
      return Promise.resolve(LOAD_RESPONSE);
    }
    if (command === "save_project_state") {
      return Promise.resolve({
        partitionFilePath: "C:/dev/esp-project/partitions.csv",
        sdkconfigUpdated: false,
      });
    }
    return Promise.reject(new Error(`unexpected command: ${command}`));
  });
}

async function loadProjectIntoHook(result: { current: ReturnType<typeof usePartitionProject> }) {
  openMock.mockResolvedValue("C:/dev/esp-project");
  mockInvokeRouting();
  await act(async () => {
    await result.current.loadProject();
  });
}

describe("usePartitionProject", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    openMock.mockReset();
    isTauriMock.mockReset();
    isTauriMock.mockReturnValue(true);
    writeTextMock.mockReset();
    writeTextMock.mockResolvedValue(undefined);
  });

  it("initializes with 2 MB defaults and three partition rows", () => {
    const { result } = renderHook(() => usePartitionProject());

    expect(result.current.flashSizeMb).toBe(2);
    expect(result.current.rows).toHaveLength(3);
    expect(result.current.hasSnapshot).toBe(false);
    expect(result.current.projectPath).toBe("");
    expect(result.current.statusMessage).toMatch(/Select an ESP-IDF project folder/);
  });

  it("updates the flash size", () => {
    const { result } = renderHook(() => usePartitionProject());

    act(() => result.current.setFlashSizeMb(16));
    expect(result.current.flashSizeMb).toBe(16);
    expect(result.current.layout.flashBytes).toBe(16 * 1024 * 1024);
  });

  it("appends an empty row with addRow", () => {
    const { result } = renderHook(() => usePartitionProject());

    act(() => result.current.addRow());
    expect(result.current.rows).toHaveLength(4);
  });

  it("updates a row field with updateRow", () => {
    const { result } = renderHook(() => usePartitionProject());
    const targetId = result.current.rows[0].id;

    act(() => result.current.updateRow(targetId, { name: "renamed" }));
    expect(result.current.rows[0].name).toBe("renamed");
  });

  it("removes the pending row with confirmDeleteRow", () => {
    const { result } = renderHook(() => usePartitionProject());
    const target = result.current.rows[1];

    act(() => result.current.setRowPendingDelete(target));
    act(() => result.current.confirmDeleteRow());

    expect(result.current.rows).toHaveLength(2);
    expect(result.current.rows.some((row) => row.id === target.id)).toBe(false);
    expect(result.current.rowPendingDelete).toBeNull();
  });

  it("updates comments", () => {
    const { result } = renderHook(() => usePartitionProject());

    act(() => result.current.setComments("my notes"));
    expect(result.current.comments).toBe("my notes");
  });

  it("reports a blocking error when loadProject runs outside Tauri", async () => {
    isTauriMock.mockReturnValue(false);
    const { result } = renderHook(() => usePartitionProject());

    await act(async () => {
      await result.current.loadProject();
    });

    expect(result.current.runtimeErrors).toHaveLength(1);
    expect(result.current.runtimeErrors[0].severity).toBe("blocking");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("does nothing when the folder dialog is cancelled", async () => {
    openMock.mockResolvedValue(null);
    const { result } = renderHook(() => usePartitionProject());

    await act(async () => {
      await result.current.loadProject();
    });

    expect(result.current.projectPath).toBe("");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("hydrates project state from the backend on a successful load", async () => {
    const { result } = renderHook(() => usePartitionProject());
    await loadProjectIntoHook(result);

    expect(invokeMock).toHaveBeenCalledWith("load_esp_project", expect.objectContaining({
      projectPath: "C:/dev/esp-project",
    }));
    expect(result.current.projectPath).toBe("C:/dev/esp-project");
    expect(result.current.partitionFilename).toBe("partitions.csv");
    expect(result.current.rows.map((row) => row.name)).toEqual(["nvs", "phy_init", "factory"]);
    expect(result.current.hasSnapshot).toBe(true);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it("surfaces a blocking error when the backend load fails", async () => {
    openMock.mockResolvedValue("C:/dev/esp-project");
    invokeMock.mockRejectedValue("CMakeLists.txt not found.");
    const { result } = renderHook(() => usePartitionProject());

    await act(async () => {
      await result.current.loadProject();
    });

    expect(result.current.runtimeErrors[0]?.severity).toBe("blocking");
    expect(result.current.projectPath).toBe("");
  });

  it("flags unsaved changes after a row is edited post-load", async () => {
    const { result } = renderHook(() => usePartitionProject());
    await loadProjectIntoHook(result);

    act(() => result.current.updateRow(result.current.rows[0].id, { name: "changed" }));
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it("does nothing when saveProject runs without a loaded project", async () => {
    const { result } = renderHook(() => usePartitionProject());

    await act(async () => {
      await result.current.saveProject();
    });

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("blocks saving while there are blocking validation errors", async () => {
    const { result } = renderHook(() => usePartitionProject());
    await loadProjectIntoHook(result);

    act(() => result.current.updateRow(result.current.rows[0].id, { size: "BADSIZE" }));
    await act(async () => {
      await result.current.saveProject();
    });

    expect(result.current.statusMessage).toMatch(/Fix validation errors/);
    expect(invokeMock).not.toHaveBeenCalledWith("save_project_state", expect.anything());
  });

  it("persists the partition file and snapshots on a successful save", async () => {
    const { result } = renderHook(() => usePartitionProject());
    await loadProjectIntoHook(result);

    act(() => result.current.updateRow(result.current.rows[0].id, { name: "storage" }));
    expect(result.current.hasUnsavedChanges).toBe(true);

    await act(async () => {
      await result.current.saveProject();
    });

    expect(invokeMock).toHaveBeenCalledWith("save_project_state", expect.objectContaining({
      request: expect.objectContaining({ projectPath: "C:/dev/esp-project" }),
    }));
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.toasts.some((toast) => toast.kind === "success")).toBe(true);
  });

  it("closes the project immediately when there are no unsaved changes", async () => {
    const { result } = renderHook(() => usePartitionProject());
    await loadProjectIntoHook(result);

    act(() => result.current.closeProject());

    expect(result.current.closeConfirmOpen).toBe(false);
    expect(result.current.projectPath).toBe("");
  });

  it("asks for confirmation before closing with unsaved changes", async () => {
    const { result } = renderHook(() => usePartitionProject());
    await loadProjectIntoHook(result);

    act(() => result.current.addRow());
    act(() => result.current.closeProject());
    expect(result.current.closeConfirmOpen).toBe(true);
    expect(result.current.projectPath).toBe("C:/dev/esp-project");

    act(() => result.current.confirmCloseProject());
    expect(result.current.projectPath).toBe("");
  });

  it("cancels the close confirmation without closing", async () => {
    const { result } = renderHook(() => usePartitionProject());
    await loadProjectIntoHook(result);

    act(() => result.current.addRow());
    act(() => result.current.closeProject());
    act(() => result.current.cancelCloseProject());

    expect(result.current.closeConfirmOpen).toBe(false);
    expect(result.current.projectPath).toBe("C:/dev/esp-project");
  });

  it("resets to defaults when there is no snapshot", () => {
    const { result } = renderHook(() => usePartitionProject());

    act(() => result.current.setFlashSizeMb(32));
    act(() => result.current.addRow());
    act(() => result.current.resetToSnapshot());

    expect(result.current.flashSizeMb).toBe(2);
    expect(result.current.rows).toHaveLength(3);
    expect(result.current.statusMessage).toMatch(/Reset to default/);
  });

  it("restores the loaded snapshot with resetToSnapshot", async () => {
    const { result } = renderHook(() => usePartitionProject());
    await loadProjectIntoHook(result);

    act(() => result.current.addRow());
    expect(result.current.rows).toHaveLength(4);

    act(() => result.current.resetToSnapshot());
    expect(result.current.rows).toHaveLength(3);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it("pushes a toast when sdkconfig sync is toggled", () => {
    const { result } = renderHook(() => usePartitionProject());

    act(() => result.current.setSyncSdkconfig(true));
    expect(result.current.syncSdkconfig).toBe(true);
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toMatch(/sync enabled/);
  });

  it("dismisses a toast by id", () => {
    const { result } = renderHook(() => usePartitionProject());

    act(() => result.current.setSyncSdkconfig(true));
    const toastId = result.current.toasts[0].id;

    act(() => result.current.dismissToast(toastId));
    expect(result.current.toasts).toHaveLength(0);
  });

  it("copies partition information through the Tauri clipboard plugin", async () => {
    const { result } = renderHook(() => usePartitionProject());

    await act(async () => {
      await result.current.copyPartitionInfo();
    });

    expect(writeTextMock).toHaveBeenCalledWith(result.current.partitionInfoText);
    expect(result.current.toasts.some((toast) => toast.kind === "success")).toBe(true);
  });

  it("copies the partition CSV through the Tauri clipboard plugin", async () => {
    const { result } = renderHook(() => usePartitionProject());

    await act(async () => {
      await result.current.copyPartitionCsv();
    });

    expect(writeTextMock).toHaveBeenCalledWith(result.current.partitionCsvText);
    expect(result.current.toasts.some((toast) => toast.kind === "success")).toBe(true);
  });

  it("builds a partition info block from the filename and offset", () => {
    const { result } = renderHook(() => usePartitionProject());

    expect(result.current.partitionInfoText).toContain('CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="partitions.csv"');
    expect(result.current.partitionInfoText).toContain("CONFIG_PARTITION_TABLE_OFFSET=0x8000");
  });
});
