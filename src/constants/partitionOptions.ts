const APP_SUBTYPES = [
  "factory",
  ...Array.from({ length: 16 }, (_, index) => `ota_${index}`),
  "test",
] as const;

const DATA_SUBTYPES = [
  "ota",
  "phy",
  "nvs",
  "coredump",
  "nvs_keys",
  "efuse",
  "undefined",
  "esphttpd",
  "fat",
  "spiffs",
  "littlefs",
] as const;

export const PARTITION_TYPE_OPTIONS = ["app", "data"] as const;

const SUBTYPE_OPTIONS_BY_TYPE: Record<string, readonly string[]> = {
  app: APP_SUBTYPES,
  data: DATA_SUBTYPES,
};

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

export function getSubtypeOptionsForType(type: string): readonly string[] {
  const normalizedType = normalizeValue(type);
  return SUBTYPE_OPTIONS_BY_TYPE[normalizedType] ?? [];
}

export function getDefaultSubtypeForType(type: string): string {
  const options = getSubtypeOptionsForType(type);
  return options[0] ?? "";
}

export function withCurrentOption(options: readonly string[], currentValue: string): string[] {
  const normalizedCurrentValue = normalizeValue(currentValue);
  if (!normalizedCurrentValue) {
    return [...options];
  }

  if (options.includes(normalizedCurrentValue)) {
    return [...options];
  }

  return [...options, normalizedCurrentValue];
}
