import { describe, expect, it } from "vitest";
import { formatBytes } from "./bytes";

describe("formatBytes", () => {
  it("keeps small sizes in bytes", () => {
    expect(formatBytes(0)).toBe("0 Б");
    expect(formatBytes(512)).toBe("512 Б");
  });

  it("switches units and uses a decimal comma", () => {
    expect(formatBytes(1536)).toBe("1,5 КБ");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5,0 МБ");
  });

  it("drops the decimals for big values and never goes negative", () => {
    expect(formatBytes(250 * 1024)).toBe("250 КБ");
    expect(formatBytes(-5)).toBe("0 Б");
  });
});
