import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type ProgressHandler = (downloaded: number, total: number | null) => void;

/** Everything the UI needs to describe and install a pending update. */
export type UpdatePrompt = {
  version: string;
  currentVersion: string;
  notes: string | null;
  update: Update;
};

export type UpdateCheckResult =
  | { status: "up-to-date" }
  | ({ status: "available" } & UpdatePrompt)
  | { status: "error"; message: string };

/**
 * Ask the updater endpoint whether a newer release exists. Never throws —
 * network/runtime failures are folded into an `error` result so callers can
 * decide whether to surface them (manual check) or ignore them (startup check).
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  try {
    const update = await check();
    if (!update) {
      return { status: "up-to-date" };
    }
    return {
      status: "available",
      version: update.version,
      currentVersion: update.currentVersion,
      notes: (update.body ?? "").trim() || null,
      update,
    };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

/** Download + install the update, reporting progress, then relaunch the app. */
export async function installAndRelaunch(
  update: Update,
  onProgress?: ProgressHandler,
): Promise<void> {
  let downloaded = 0;
  let total: number | null = null;

  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? null;
      onProgress?.(0, total);
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress?.(downloaded, total);
    } else if (event.event === "Finished") {
      onProgress?.(total ?? downloaded, total);
    }
  });

  await relaunch();
}
