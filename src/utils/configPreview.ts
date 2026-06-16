import type { Platform } from "../types";

export interface ConfigPreviewParams {
  partitionFilename: string;
  partitionOffset: string;
}

function safeFilename(name: string): string {
  return (name.trim() || "partitions.csv");
}

function espIdfBlock({ partitionFilename, partitionOffset }: ConfigPreviewParams): string {
  const file = safeFilename(partitionFilename).replace(/"/g, '\\"');
  const offset = partitionOffset.trim() || "0x8000";
  return [
    "#",
    "# Partition Table",
    "#",
    "# CONFIG_PARTITION_TABLE_SINGLE_APP is not set",
    "# CONFIG_PARTITION_TABLE_SINGLE_APP_LARGE is not set",
    "# CONFIG_PARTITION_TABLE_TWO_OTA is not set",
    "CONFIG_PARTITION_TABLE_CUSTOM=y",
    `CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="${file}"`,
    `CONFIG_PARTITION_TABLE_FILENAME="${file}"`,
    `CONFIG_PARTITION_TABLE_OFFSET=${offset}`,
    "CONFIG_PARTITION_TABLE_MD5=y",
    "# end of Partition Table",
  ].join("\n");
}

function platformIoBlock({ partitionFilename }: ConfigPreviewParams): string {
  const file = safeFilename(partitionFilename);
  return [
    "; platformio.ini",
    "[env:your_env]",
    `board_build.partitions = ${file}`,
  ].join("\n");
}

function arduinoBlock({ partitionFilename }: ConfigPreviewParams): string {
  const file = safeFilename(partitionFilename);
  return [
    `; Place ${file} in the sketch folder.`,
    '; Arduino IDE: Tools -> Partition Scheme -> "Custom" (or "Huge App").',
    "; Then do a clean rebuild so the new layout is picked up.",
  ].join("\n");
}

export function buildConfigPreview(platform: Platform, params: ConfigPreviewParams): string {
  switch (platform) {
    case "platformio":
      return platformIoBlock(params);
    case "arduino":
      return arduinoBlock(params);
    case "esp-idf":
    default:
      return espIdfBlock(params);
  }
}
