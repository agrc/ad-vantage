import { describe, expect, it } from "vitest";
import {
  deserializeLookupEntries,
  deserializeLookupMap,
} from "../shared/lookup";
import { mapTaskRecords } from "./servicenow";

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
