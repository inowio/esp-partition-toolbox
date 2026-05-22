import { useEffect, useState } from "react";
import "./App.css";
import AboutModal from "./components/AboutModal";
import AppNavbar from "./components/AppNavbar";
import CommentsCard from "./components/CommentsCard";
import EditableContextMenu from "./components/EditableContextMenu";
import CloseProjectModal from "./components/CloseProjectModal";
import DeletePartitionModal from "./components/DeletePartitionModal";
import ErrorCard from "./components/ErrorCard";
import HelpModal from "./components/HelpModal";
import KpiCards from "./components/KpiCards";
import PartitionInformationCard from "./components/PartitionInformationCard";
import PartitionPreviewCard from "./components/PartitionPreviewCard";
import PartitionTableCard from "./components/PartitionTableCard";
import ProjectHeaderCard from "./components/ProjectHeaderCard";
import ToastStack from "./components/ToastStack";
import UpdateDialog from "./components/UpdateDialog";
import VisualMapCard from "./components/VisualMapCard";
import { checkForUpdate, installAndRelaunch } from "./api/updater";
import type { UpdatePrompt } from "./api/updater";
import usePartitionProject from "./hooks/usePartitionProject";

const FLASH_OPTIONS_MB = [2, 4, 8, 16, 32, 64, 128, 256, 512];

function App() {
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [updatePrompt, setUpdatePrompt] = useState<UpdatePrompt | null>(null);

  const {
    isBusy,
    projectPath,
    sdkconfigFile,
    sdkconfigFiles,
    syncSdkconfig,
    partitionFilename,
    partitionOffset,
    flashSizeMb,
    comments,
    statusMessage,
    rowPendingDelete,
    layout,
    allErrors,
    closeConfirmOpen,
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
  } = usePartitionProject();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkTheme);
  }, [isDarkTheme]);

  // Silently check for a newer release on startup. Failures (offline, not in
  // the Tauri runtime) are swallowed by checkForUpdate and simply skipped.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await checkForUpdate();
      if (!cancelled && result.status === "available") {
        setUpdatePrompt({
          version: result.version,
          currentVersion: result.currentVersion,
          notes: result.notes,
          update: result.update,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Suppress the WebView's browser context menu (Reload / Save as / Print …)
  // everywhere — it looks out of place in a desktop app. Editable fields get a
  // themed Cut / Copy / Paste menu instead, via <EditableContextMenu />. An
  // element can opt back into the native menu with data-allow-context-menu.
  useEffect(() => {
    function handleContextMenu(event: MouseEvent): void {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-allow-context-menu='true']")) {
        return;
      }
      event.preventDefault();
    }

    document.addEventListener("contextmenu", handleContextMenu);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  function toggleTheme(): void {
    setIsDarkTheme((currentTheme) => !currentTheme);
  }

  const appVersion = __APP_VERSION__;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <AppNavbar
        isDarkTheme={isDarkTheme}
        appVersion={appVersion}
        onToggleTheme={toggleTheme}
        onShowAbout={() => setIsAboutOpen(true)}
        onShowHelp={() => setIsHelpOpen(true)}
      />

      <main className="flex w-full flex-col gap-5 px-4 py-5 md:px-8 md:py-7">
        <ProjectHeaderCard
          flashOptions={FLASH_OPTIONS_MB}
          flashSizeMb={flashSizeMb}
          projectPath={projectPath}
          sdkconfigFile={sdkconfigFile}
          sdkconfigFiles={sdkconfigFiles}
          syncSdkconfig={syncSdkconfig}
          partitionFilename={partitionFilename}
          partitionOffset={partitionOffset}
          statusMessage={statusMessage}
          isBusy={isBusy}
          onFlashSizeChange={setFlashSizeMb}
          onSdkconfigFileChange={setSdkconfigFile}
          onSyncSdkconfigChange={setSyncSdkconfig}
          onLoad={loadProject}
          onSave={saveProject}
          onClose={closeProject}
          onReset={resetToSnapshot}
        />

        <KpiCards
          flashBytes={layout.flashBytes}
          allocated={layout.allocated}
          free={layout.free}
          reservedBytes={layout.reservedBytes}
        />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <VisualMapCard
            rows={layout.rows}
            flashBytes={layout.flashBytes}
            reservedBytes={layout.reservedBytes}
          />
          <ErrorCard errors={allErrors} />
        </section>
        <PartitionTableCard
          rows={layout.rows}
          flashBytes={layout.flashBytes}
          onAddRow={addRow}
          onUpdateRow={updateRow}
          onRequestDelete={setRowPendingDelete}
        />

        <div className="grid gap-4 xl:grid-cols-2">
          <PartitionPreviewCard
            csv={partitionCsvText}
            onCopy={copyPartitionCsv}
            isBusy={isBusy}
          />

          <PartitionInformationCard
            partitionInfo={partitionInfoText}
            onCopy={copyPartitionInfo}
            isBusy={isBusy}
          />
        </div>

        <CommentsCard comments={comments} onCommentsChange={setComments} />
      </main>

      <DeletePartitionModal
        row={rowPendingDelete}
        onCancel={() => setRowPendingDelete(null)}
        onConfirm={confirmDeleteRow}
      />

      <CloseProjectModal
        open={closeConfirmOpen}
        onCancel={cancelCloseProject}
        onConfirm={confirmCloseProject}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <EditableContextMenu />

      <AboutModal
        open={isAboutOpen}
        appVersion={appVersion}
        onClose={() => setIsAboutOpen(false)}
        onUpdateAvailable={(prompt) => {
          setIsAboutOpen(false);
          setUpdatePrompt(prompt);
        }}
      />

      <HelpModal open={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {updatePrompt ? (
        <UpdateDialog
          open
          version={updatePrompt.version}
          currentVersion={updatePrompt.currentVersion}
          notes={updatePrompt.notes}
          install={(onProgress) => installAndRelaunch(updatePrompt.update, onProgress)}
          onClose={() => setUpdatePrompt(null)}
        />
      ) : null}
    </div>
  );
}

export default App;
