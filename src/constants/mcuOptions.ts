export interface McuOption {
  id: string;
  label: string;
}

export const MCU_OPTIONS: McuOption[] = [
  { id: "esp32", label: "ESP32" },
  { id: "esp32s2", label: "ESP32-S2" },
  { id: "esp32s3", label: "ESP32-S3" },
  { id: "esp32c2", label: "ESP32-C2" },
  { id: "esp32c3", label: "ESP32-C3" },
  { id: "esp32c5", label: "ESP32-C5" },
  { id: "esp32c6", label: "ESP32-C6" },
  { id: "esp32h2", label: "ESP32-H2" },
  { id: "esp32p4", label: "ESP32-P4" },
];

export function mcuLabel(id: string): string {
  return MCU_OPTIONS.find((m) => m.id === id)?.label ?? id;
}

/** Keep a detected-but-unlisted chip selectable, like withCurrentOption for subtypes. */
export function withDetectedMcu(detected: string | null): McuOption[] {
  if (!detected) return [...MCU_OPTIONS];
  const normalized = detected.trim().toLowerCase();
  if (!normalized || MCU_OPTIONS.some((m) => m.id === normalized)) return [...MCU_OPTIONS];
  return [...MCU_OPTIONS, { id: normalized, label: mcuLabel(normalized) }];
}
