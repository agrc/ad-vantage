import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deserializeLookupEntries,
  deserializeLookupMap,
} from "../shared/lookup";
import { clearAuthToken } from "../shared/storage";
import { getValidAccessToken } from "./oauth";
import { fetchTaskLookup, mapTaskRecords } from "./servicenow";

vi.mock("../shared/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../shared/storage")>()),
  clearAuthToken: vi.fn(),
}));

vi.mock("./oauth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./oauth")>()),
  getValidAccessToken: vi.fn(),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.mocked(getValidAccessToken)
    .mockReset()
    .mockResolvedValueOnce("expired-token")
    .mockResolvedValue("fresh-token");
});

describe("mapTaskRecords", () => {
  it("maps task numbers and descriptions into the lookup contract", () => {
    const lookup = mapTaskRecords([
      { number: " PRJ001 ", short_description: "  Replace monitor  " },
      { number: "", short_description: "ignored" },
      { number: 42, short_description: "ignored" },
    ]);

    expect(deserializeLookupMap(lookup)).toEqual(
      new Map([["PRJ001", "Replace monitor"]]),
    );
    expect(deserializeLookupEntries(lookup)).toEqual([
      {
        taskCode: "PRJ001",
        description: "Replace monitor",
        searchText: "PRJ001 Replace monitor",
      },
    ]);
  });
});

describe("fetchTaskLookup", () => {
  it("clears a rejected token and retries once", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        Response.json({
          result: [{ number: "PRJ001", short_description: "Replace monitor" }],
        }),
      );

    await expect(fetchTaskLookup()).resolves.toMatchObject({ entryCount: 1 });

    expect(clearAuthToken).toHaveBeenCalledOnce();
    expect(getValidAccessToken).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: "Bearer expired-token" },
    });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: { Authorization: "Bearer fresh-token" },
    });
  });

  it("stops after a second unauthorized response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 401 }),
    );

    await expect(fetchTaskLookup()).rejects.toThrow(
      "ServiceNow session expired. Fetch again to sign in.",
    );

    expect(clearAuthToken).toHaveBeenCalledOnce();
    expect(getValidAccessToken).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
