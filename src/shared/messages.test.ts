import { describe, expect, it } from "vitest";
import {
  ADD_DAILY_ACTIVITY_ROW_MESSAGE_TYPE,
  GET_COLUMNS_MESSAGE_TYPE,
  GET_ROWS_MESSAGE_TYPE,
  isAddDailyActivityRowRequest,
  isGetColumnsRequest,
  isGetColumnsResponse,
  isGetRowsRequest,
  isGetRowsResponse,
  isServiceNowSyncRequest,
  SERVICE_NOW_SYNC_MESSAGE_TYPE,
} from "./messages";

describe("runtime message guards", () => {
  it("accepts only recognized request shapes", () => {
    expect(
      isAddDailyActivityRowRequest({
        type: ADD_DAILY_ACTIVITY_ROW_MESSAGE_TYPE,
      }),
    ).toBe(true);
    expect(isGetColumnsRequest({ type: GET_COLUMNS_MESSAGE_TYPE })).toBe(true);
    expect(isGetRowsRequest({ type: GET_ROWS_MESSAGE_TYPE })).toBe(true);
    expect(
      isServiceNowSyncRequest({ type: SERVICE_NOW_SYNC_MESSAGE_TYPE }),
    ).toBe(true);
    expect(isGetColumnsRequest({ type: "unknown" })).toBe(false);
    expect(isGetRowsRequest({ type: "unknown" })).toBe(false);
    expect(isAddDailyActivityRowRequest({ type: "unknown" })).toBe(false);
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

  it("validates every returned row", () => {
    expect(
      isGetRowsResponse({
        rows: [{ label: "Scheduled Hours" }],
      }),
    ).toBe(true);
    expect(isGetRowsResponse({ rows: [{}] })).toBe(false);
    expect(isGetRowsResponse({ rows: "not-an-array" })).toBe(false);
  });
});
