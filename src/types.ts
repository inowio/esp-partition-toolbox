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
  encrypted: boolean;
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

export interface LoadProjectResponse {
  projectPath: string;
  sdkconfigFile: string;
  sdkconfigFiles: string[];
  partitionFilename: string;
  partitionFilePath: string;
  partitionContent: string;
  partitionFileExists: boolean;
  sdkconfigUpdated: boolean;
  partitionOffset: string;
}

export interface SaveProjectResponse {
  partitionFilePath: string;
  sdkconfigUpdated: boolean;
}
