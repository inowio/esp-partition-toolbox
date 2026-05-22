import { useEffect, useState } from "react";
import "./App.css";
import AppNavbar from "./components/AppNavbar";
import CommentsCard from "./components/CommentsCard";
import CloseProjectModal from "./components/CloseProjectModal";
import DeletePartitionModal from "./components/DeletePartitionModal";
import ErrorCard from "./components/ErrorCard";
import KpiCards from "./components/KpiCards";
import PartitionInformationCard from "./components/PartitionInformationCard";
import PartitionTableCard from "./components/PartitionTableCard";
import ProjectHeaderCard from "./components/ProjectHeaderCard";
import ToastStack from "./components/ToastStack";
import VisualMapCard from "./components/VisualMapCard";
import usePartitionProject from "./hooks/usePartitionProject";

const FLASH_OPTIONS_MB = [2, 4, 8, 16, 32, 64, 128, 256, 512];

function App() {
  const [isDarkTheme, setIsDarkTheme] = useState(true);

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
    hasSnapshot,
    closeConfirmOpen,
    toasts,
    partitionInfoText,
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
  } = usePartitionProject();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkTheme);
  }, [isDarkTheme]);

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
          hasSnapshot={hasSnapshot}
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
          usableBytes={layout.usable}
          onAddRow={addRow}
          onUpdateRow={updateRow}
          onRequestDelete={setRowPendingDelete}
        />

        <div className="grid gap-4 xl:grid-cols-2">
          <PartitionInformationCard
            partitionInfo={partitionInfoText}
            onCopy={copyPartitionInfo}
            isBusy={isBusy}
          />

          <CommentsCard comments={comments} onCommentsChange={setComments} />
        </div>
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
    </div>
  );
}

export default App;
