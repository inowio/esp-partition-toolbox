import type { Platform } from "../types";

export interface PlatformOption {
  id: Platform;
  label: string;
}

export const PLATFORM_OPTIONS: PlatformOption[] = [
  { id: "esp-idf", label: "ESP-IDF" },
  { id: "platformio", label: "PlatformIO" },
  { id: "arduino", label: "Arduino" },
];

export function platformLabel(id: Platform): string {
  return PLATFORM_OPTIONS.find((p) => p.id === id)?.label ?? id;
}
