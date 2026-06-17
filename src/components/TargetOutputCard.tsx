import type { ConfigTarget, Platform } from "../types";
import { PLATFORM_OPTIONS } from "../constants/platformOptions";
import { mcuLabel, withDetectedMcu } from "../constants/mcuOptions";

interface TargetOutputCardProps {
  platform: Platform;
  mcu: string | null;
  flashSizeMb: number;
  flashOptions: number[];
  partitionFilename: string;
  projectPath: string;
  syncSdkconfig: boolean;
  sdkconfigFile: string;
  configTargets: ConfigTarget[];
  configUpdatable: boolean;
  isBusy: boolean;
  onPlatformChange: (value: Platform) => void;
  onMcuChange: (value: string) => void;
  onFlashSizeChange: (value: number) => void;
  onSyncSdkconfigChange: (value: boolean) => void;
  onSdkconfigFileChange: (value: string) => void;
}

export default function TargetOutputCard(props: TargetOutputCardProps) {
  const {
    platform, mcu, flashSizeMb, flashOptions, partitionFilename, projectPath,
    syncSdkconfig, sdkconfigFile, configTargets, configUpdatable, isBusy,
    onPlatformChange, onMcuChange, onFlashSizeChange, onSyncSdkconfigChange, onSdkconfigFileChange,
  } = props;

  const mcuOptions = withDetectedMcu(mcu);
  const selectClass = "rounded-md border border-slate-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-sky-500 dark:border-slate-700";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">Platform</span>
          <select title="Select platform" value={platform} disabled={isBusy}
            onChange={(e) => onPlatformChange(e.currentTarget.value as Platform)} className={selectClass}>
            {PLATFORM_OPTIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">MCU</span>
          <select title="Select target chip (informational)" value={mcu ?? ""} disabled={isBusy}
            onChange={(e) => onMcuChange(e.currentTarget.value)} className={selectClass}>
            {mcu === null && <option value="">—</option>}
            {mcuOptions.map((m) => <option key={m.id} value={m.id}>{mcuLabel(m.id)}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">Flash</span>
          <select title="Select flash size" value={flashSizeMb} disabled={isBusy}
            onChange={(e) => onFlashSizeChange(Number(e.currentTarget.value))} className={selectClass}>
            {flashOptions.map((s) => <option key={s} value={s}>{s} MB</option>)}
          </select>
        </label>

        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          <span className="font-semibold">Partition file:</span> {partitionFilename}
        </span>
      </div>

      {projectPath && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-700">
          <span className="font-semibold text-slate-600 dark:text-slate-300">Config sync</span>
          <label className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${syncSdkconfig ? "bg-sky-600" : "bg-slate-400 dark:bg-slate-600"} ${isBusy ? "opacity-70" : ""}`}>
            <input type="checkbox" checked={syncSdkconfig} disabled={isBusy}
              onChange={(e) => onSyncSdkconfigChange(e.currentTarget.checked)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              title="Write partition settings into the platform config file" />
            <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white transition-transform ${syncSdkconfig ? "translate-x-5" : "translate-x-1"}`} />
          </label>
          <span className={`text-[10px] font-semibold ${syncSdkconfig ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}>
            {syncSdkconfig ? "sync on" : "sync off"}
          </span>

          {configUpdatable ? (
            <>
              <select value={sdkconfigFile} disabled={!syncSdkconfig || isBusy}
                onChange={(e) => onSdkconfigFileChange(e.currentTarget.value)}
                title="Select a config target"
                className="min-w-36 max-w-56 rounded border border-slate-300 bg-transparent px-1.5 py-1 text-xs outline-none disabled:opacity-60 dark:border-slate-700">
                {configTargets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              {!syncSdkconfig && <span className="text-[10px] text-amber-600 dark:text-amber-300">manual config update required</span>}
            </>
          ) : (
            <span className="text-[10px] text-amber-600 dark:text-amber-300">
              Bare sketch — no committable config. The CSV is written to the sketch folder; set Tools → Partition Scheme → "Custom" and do a clean rebuild.
            </span>
          )}
        </div>
      )}
    </section>
  );
}
