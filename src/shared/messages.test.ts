import { describe, expect, it } from "vitest";
import {
  GET_COLUMNS_MESSAGE_TYPE,
  isGetColumnsRequest,
  isGetColumnsResponse,
  isServiceNowSyncRequest,
  SERVICE_NOW_SYNC_MESSAGE_TYPE,
} from "./messages";

describe("runtime message guards", () => {
  it("accepts only recognized request shapes", () => {
    expect(isGetColumnsRequest({ type: GET_COLUMNS_MESSAGE_TYPE })).toBe(true);
    expect(
      isServiceNowSyncRequest({ type: SERVICE_NOW_SYNC_MESSAGE_TYPE }),
    ).toBe(true);
    expect(isGetColumnsRequest({ type: "unknown" })).toBe(false);
    expect(isServiceNowSyncRequest(null)).toBe(false);
  });

  it("validates every returned column", () => {
    expect(
      isGetColumnsResponse({
        columns: [{ key: "DLY_ACTV_CD", label: "Daily Activity" }],
      }),
    ).toBe(true);
    expect(isGetColumnsResponse({ columns: [{ key: "DLY_ACTV_CD" }] })).toBe(
      false,
    );
    expect(isGetColumnsResponse({ columns: "not-an-array" })).toBe(false);
  });
});
