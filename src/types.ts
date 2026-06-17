export type ErrorSeverity = "blocking" | "warning";

export interface ValidationError {
  message: string;
  severity: ErrorSeverity;
}

export type ToastKind = "success" | "info" | "warning" | "error";

export interface ToastMessage {
  id: string;
  message: string;
  kind: ToastKind;
}

export interface PartitionDraftRow {
  id: string;
  name: string;
  type: string;
  subtype: string;
  size: string;
  /** Pinned start offset (hex string). Empty = auto-packed after the previous partition. */
  pinnedOffset: string;
  encrypted: boolean;
  readonly: boolean;
}

export interface PartitionLayoutRow extends PartitionDraftRow {
  offset: number;
  end: number;
  sizeBytes: number;
  flags: string;
}

export interface PartitionLayoutResult {
  rows: PartitionLayoutRow[];
  errors: ValidationError[];
  allocated: number;
  free: number;
  usable: number;
  flashBytes: number;
  reservedBytes: number;
}

export type Platform = "esp-idf" | "platformio" | "arduino";

export interface ConfigTarget {
  id: string;
  label: string;
}

export interface LoadProjectResponse {
  platform: Platform;
  platformConfidence: string;
  markers: string[];
  projectPath: string;
  mcu: string | null;
  sdkconfigFile: string;
  configTargets: ConfigTarget[];
  configUpdatable: boolean;
  partitionFilename: string;
  partitionFilePath: string;
  partitionContent: string;
  partitionFileExists: boolean;
  partitionOffset: string;
  /** Detected from `CONFIG_ESPTOOLPY_FLASHSIZE`; null when not present. */
  flashSizeMb: number | null;
  warnings: string[];
}

export interface SaveProjectResponse {
  partitionFilePath: string;
  sdkconfigUpdated: boolean;
  warnings: string[];
}
