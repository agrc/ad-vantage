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
  it("requests active tasks ending within the last two weeks and advances pagination offsets", async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      number: `PRJ${index}`,
      short_description: `Task ${index}`,
    }));
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ result: firstPage }))
      .mockResolvedValueOnce(Response.json({ result: [] }));

    await expect(fetchTaskLookup()).resolves.toMatchObject({ entryCount: 500 });

    const firstUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const secondUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(firstUrl.searchParams.get("sysparm_query")).toBe(
      "active=true" +
        "^end_date>=javascript:gs.daysAgoStart(14)" +
        "^assigned_to=javascript:gs.getUserID()" +
        "^ORassignment_group=javascript:getMyGroups()" +
        "^ORadditional_assignee_listLIKEjavascript:gs.getUserID()",
    );
    expect(firstUrl.searchParams.get("sysparm_offset")).toBe("0");
    expect(secondUrl.searchParams.get("sysparm_offset")).toBe("500");
  });

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

  it("reports non-OK and malformed responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 503 }),
    );
    await expect(fetchTaskLookup()).rejects.toThrow(
      "ServiceNow task fetch failed (503).",
    );

    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ result: {} }));
    await expect(fetchTaskLookup()).rejects.toThrow(
      "ServiceNow returned an invalid task response.",
    );
  });
});
