import { FiMoon, FiSun } from "react-icons/fi";

interface AppNavbarProps {
  isDarkTheme: boolean;
  appVersion: string;
  onToggleTheme: () => void;
}

export default function AppNavbar({
  isDarkTheme,
  appVersion,
  onToggleTheme,
}: AppNavbarProps) {
  return (
    <nav className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur md:px-8 dark:border-slate-800 dark:bg-slate-900/85">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/tauri.svg" className="h-8 w-8" alt="ESP Partition Toolbox logo" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">ESP Partition Toolbox</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Version {appVersion}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {isDarkTheme ? <FiSun /> : <FiMoon />}
          {isDarkTheme ? "Light" : "Dark"}
        </button>
      </div>
    </nav>
  );
}
