import { FiAlertOctagon, FiAlertTriangle, FiCheckCircle } from "react-icons/fi";
import type { ValidationError } from "../types";

interface ErrorCardProps {
  errors: ValidationError[];
}

export default function ErrorCard({ errors }: ErrorCardProps) {
  const blockingCount = errors.filter((e) => e.severity === "blocking").length;
  const warningCount = errors.length - blockingCount;
  const hasErrors = errors.length > 0;

  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm ${
        hasErrors
          ? "border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40"
          : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
      }`}
    >
      <div
        className={`mb-3 flex items-center gap-2 ${
          hasErrors
            ? "text-rose-700 dark:text-rose-300"
            : "text-emerald-700 dark:text-emerald-300"
        }`}
      >
        {hasErrors ? <FiAlertTriangle /> : <FiCheckCircle />}
        <h2 className="text-base font-semibold">Validation</h2>
        {hasErrors && (
          <span className="ml-auto text-xs font-medium">
            {blockingCount > 0 && <span className="text-rose-600 dark:text-rose-300">{blockingCount} error{blockingCount !== 1 ? "s" : ""}</span>}
            {blockingCount > 0 && warningCount > 0 && <span className="text-slate-400"> · </span>}
            {warningCount > 0 && <span className="text-amber-600 dark:text-amber-300">{warningCount} warning{warningCount !== 1 ? "s" : ""}</span>}
          </span>
        )}
      </div>

      {!hasErrors ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">All partitions are valid.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {errors.map((error, index) => (
            <li
              key={index}
              className={`flex items-start gap-2 rounded-lg p-2 ${
                error.severity === "blocking"
                  ? "bg-white/70 text-rose-700 dark:bg-rose-900/35 dark:text-rose-200"
                  : "bg-amber-50/80 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
              }`}
            >
              {error.severity === "blocking" ? (
                <FiAlertOctagon className="mt-0.5 shrink-0 text-rose-500 dark:text-rose-400" />
              ) : (
                <FiAlertTriangle className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400" />
              )}
              <span>{error.message}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
