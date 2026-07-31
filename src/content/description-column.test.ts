import { describe, expect, it, vi } from "vitest";
import { DESCRIPTION_COL_KEY } from "../shared/constants";
import { syncDescriptionColumns } from "./description-column";

function createGrid(): {
  grid: HTMLTableElement;
  headerRow: HTMLTableRowElement;
} {
  const grid = document.createElement("table");
  grid.innerHTML = `
    <thead><tr>
      <th data-qa="DLY_ACTV_CD">Daily Activity</th>
      <th><span data-qa-id="grid.headerCellTitle">Mon 07/27</span></th>
    </tr></thead>
    <tbody>
      <tr data-row="known"><td><input value="PRJ-1"></td><td>1:00</td></tr>
      <tr data-row="missing"><td>PRJ-2</td><td>1:00</td></tr>
      <tr data-row="summary"><td>Total Hours</td><td>2:00</td></tr>
    </tbody>
  `;
  return { grid, headerRow: grid.querySelector("thead tr")! };
}

describe("syncDescriptionColumns", () => {
  it("inserts the description header after Daily Activity", () => {
    const { grid, headerRow } = createGrid();

    syncDescriptionColumns(grid, [headerRow], headerRow, new Map(), vi.fn());

    expect(headerRow.children[1].getAttribute("data-qa")).toBe(
      DESCRIPTION_COL_KEY,
    );
    expect(headerRow.children[1].textContent).toBe("Description");
  });

  it("renders lookup descriptions and reports missing task codes", () => {
    const { grid, headerRow } = createGrid();
    const onMissingTask = vi.fn();

    syncDescriptionColumns(
      grid,
      [headerRow],
      headerRow,
      new Map([["PRJ-1", "Monitor"]]),
      onMissingTask,
    );

    expect(
      grid.querySelector(
        `[data-row="known"] [data-qa="${DESCRIPTION_COL_KEY}"]`,
      )?.textContent,
    ).toBe("Monitor");
    expect(
      grid.querySelector(
        `[data-row="missing"] [data-qa="${DESCRIPTION_COL_KEY}"]`,
      )?.textContent,
    ).toBe("");
    expect(onMissingTask).toHaveBeenCalledWith("PRJ-2");
  });

  it("adds an empty description cell to summary rows", () => {
    const { grid, headerRow } = createGrid();

    syncDescriptionColumns(grid, [headerRow], headerRow, new Map(), vi.fn());

    const summaryCells = grid.querySelector('[data-row="summary"]')?.children;
    expect(summaryCells).toHaveLength(3);
    expect(summaryCells?.[1].getAttribute("data-qa")).toBe(DESCRIPTION_COL_KEY);
  });
});
