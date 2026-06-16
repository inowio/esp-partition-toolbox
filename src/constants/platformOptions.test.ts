import { describe, expect, it } from "vitest";
import { PLATFORM_OPTIONS, platformLabel } from "./platformOptions";

describe("platformOptions", () => {
  it("lists the three platforms in order", () => {
    expect(PLATFORM_OPTIONS.map((p) => p.id)).toEqual(["esp-idf", "platformio", "arduino"]);
  });
  it("maps ids to human labels", () => {
    expect(platformLabel("esp-idf")).toBe("ESP-IDF");
    expect(platformLabel("platformio")).toBe("PlatformIO");
    expect(platformLabel("arduino")).toBe("Arduino");
  });
  it("falls back to the id for unknown platforms", () => {
    expect(platformLabel("unknown" as never)).toBe("unknown");
  });
});
