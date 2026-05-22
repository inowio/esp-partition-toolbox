import type { PartitionDraftRow } from "../types";

interface DeletePartitionModalProps {
  row: PartitionDraftRow | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeletePartitionModal({
  row,
  onCancel,
  onConfirm,
}: DeletePartitionModalProps) {
  if (!row) {
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
        <h3 className="text-lg font-semibold">Delete partition?</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          This will remove <span className="font-semibold">{row.name}</span> from the current table.
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
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
