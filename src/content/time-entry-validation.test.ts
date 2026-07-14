import { describe, expect, it } from "vitest";
import {
  hasEnteredTimeValue,
  shouldWarnForMissingEvent,
} from "./time-entry-validation";

describe("hasEnteredTimeValue", () => {
  it.each([
    ["", false],
    ["0", false],
    ["-", false],
    ["00:00", false],
    ["0:00", false],
    ["01:00", true],
    ["00:15", true],
    ["1.5", true],
  ])("treats %j as entered time: %s", (value, expected) => {
    expect(hasEnteredTimeValue(value)).toBe(expected);
  });
});

describe("shouldWarnForMissingEvent", () => {
  it("warns when an empty Event has entered time", () => {
    expect(shouldWarnForMissingEvent("", ["", "01:00", "-"])).toBe(
      true,
    );
  });

  it("does not warn when the Event is populated", () => {
    expect(shouldWarnForMissingEvent("TW", ["01:00"])).toBe(false);
  });

  it("does not warn for empty Event on an unused row", () => {
    expect(shouldWarnForMissingEvent("", ["", "00:00", "-"])).toBe(
      false,
    );
  });
});