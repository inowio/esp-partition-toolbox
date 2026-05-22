interface CloseProjectModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function CloseProjectModal({ open, onCancel, onConfirm }: CloseProjectModalProps) {
  if (!open) {
    return <></>;
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/45 px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Close project?</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Partition information is not saved. Click <span className="font-semibold">Cancel</span> to save before
          closing, or click <span className="font-semibold">Okay</span> to close the project.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
          >
            Okay
          </button>
        </div>
      </div>
    </div>
  );
}
