import { describe, expect, it } from "vitest";
import { deserializeLookupEntries, deserializeLookupMap } from "./lookup";
import type { LookupDataRecord } from "./storage";

describe("lookup deserialization", () => {
  it("filters malformed map entries", () => {
    const data = {
      entries: [["TASK-1", "Valid"], ["TASK-2"], [42, "Invalid"]],
      entryCount: 3,
      uploadedAt: "2026-07-30T00:00:00.000Z",
    } as unknown as LookupDataRecord;

    expect(deserializeLookupMap(data)).toEqual(new Map([["TASK-1", "Valid"]]));
  });

  it("falls back to likely task codes when search entries are unavailable", () => {
    const data: LookupDataRecord = {
      entries: [
        ["PRJ001", "Project task"],
        ["description", "Not a task code"],
      ],
      entryCount: 2,
      uploadedAt: "2026-07-30T00:00:00.000Z",
    };

    expect(deserializeLookupEntries(data)).toEqual([
      {
        taskCode: "PRJ001",
        description: "Project task",
        searchText: "PRJ001 Project task",
      },
    ]);
  });

  it("filters malformed persisted search entries", () => {
    const data = {
      entries: [],
      searchEntries: [
        {
          taskCode: " PRJ001 ",
          description: " Task ",
          searchText: " PRJ001 Task ",
        },
        { taskCode: 42, description: "Invalid", searchText: "Invalid" },
      ],
      entryCount: 2,
      uploadedAt: "2026-07-30T00:00:00.000Z",
    } as unknown as LookupDataRecord;

    expect(deserializeLookupEntries(data)).toEqual([
      {
        taskCode: "PRJ001",
        description: "Task",
        searchText: "PRJ001 Task",
      },
    ]);
  });
});
