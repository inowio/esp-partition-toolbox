interface CommentsCardProps {
  comments: string;
  onCommentsChange: (value: string) => void;
}

export default function CommentsCard({ comments, onCommentsChange }: CommentsCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Comments</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Comments to be included in the partition CSV.
          </p>
        </div>
      </div>
      <textarea
        value={comments}
        onChange={(event) => onCommentsChange(event.currentTarget.value)}
        rows={6}
        placeholder="Add one comment per line. These lines are written as # comments in partition CSV."
        className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-700"
      />
    </section>
  );
}
