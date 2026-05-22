import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Open a URL in the user's default browser. The locked-down Tauri webview
 * ignores plain anchor navigation, so external links must route through the
 * opener plugin. Best-effort: failures (e.g. running outside Tauri) are
 * swallowed since there is nothing actionable to surface.
 */
export async function openExternal(url: string): Promise<void> {
  try {
    await openUrl(url);
  } catch {
    // No system browser reachable — ignore.
  }
}
