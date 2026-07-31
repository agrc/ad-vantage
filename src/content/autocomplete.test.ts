import { describe, expect, it } from "vitest";
import {
  buildAutocompleteEntries,
  getAutocompleteSuggestions,
} from "./autocomplete";

const entries = buildAutocompleteEntries([
  {
    taskCode: "PRJ-2",
    description: "Replace monitor",
    searchText: "PRJ-2 Replace monitor",
  },
  { taskCode: "PRJ-1", description: "Monitor", searchText: "PRJ-1 Monitor" },
  {
    taskCode: "NET-1",
    description: "Network monitor upgrade",
    searchText: "NET-1 Network monitor upgrade",
  },
  { taskCode: "", description: "Ignored", searchText: "Ignored" },
]);

describe("autocomplete ranking", () => {
  it("normalizes input and prioritizes exact description then exact code", () => {
    expect(
      getAutocompleteSuggestions(entries, "  MONITOR ").map(
        ({ taskCode }) => taskCode,
      ),
    ).toEqual(["PRJ-1", "PRJ-2", "NET-1"]);

    expect(getAutocompleteSuggestions(entries, "prj-2")[0].taskCode).toBe(
      "PRJ-2",
    );
  });

  it("returns no results for blank or unmatched queries", () => {
    expect(getAutocompleteSuggestions(entries, "  ")).toEqual([]);
    expect(getAutocompleteSuggestions(entries, "unmatched")).toEqual([]);
  });

  it("limits results to eight", () => {
    const manyEntries = buildAutocompleteEntries(
      Array.from({ length: 12 }, (_, index) => ({
        taskCode: `TASK-${index}`,
        description: `Shared task ${index}`,
        searchText: `TASK-${index} Shared task ${index}`,
      })),
    );

    expect(getAutocompleteSuggestions(manyEntries, "shared")).toHaveLength(8);
  });
});
