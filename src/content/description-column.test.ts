import { describe, expect, it, vi } from "vitest";
import { DESCRIPTION_COL_KEY } from "../shared/constants";
import {
  syncDescriptionColumns,
  syncDescriptionHeaderCell,
  syncStickyHeaderColumnWidths,
} from "./description-column";

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

  it("matches the sticky Description header to the current grid width", () => {
    const sourceRow = document.createElement("tr");
    const stickyRow = document.createElement("tr");
    const sourceHeader = document.createElement("th");
    const stickyHeader = document.createElement("th");
    sourceHeader.setAttribute("data-qa", DESCRIPTION_COL_KEY);
    stickyHeader.setAttribute("data-qa", DESCRIPTION_COL_KEY);
    sourceRow.appendChild(sourceHeader);
    stickyRow.appendChild(stickyHeader);
    vi.spyOn(sourceHeader, "getBoundingClientRect").mockReturnValue({
      width: 119,
    } as DOMRect);

    syncStickyHeaderColumnWidths(
      [{ index: 1, width: 119, left: 0 }],
      stickyRow,
    );

    expect(stickyHeader.style.width).toBe("119px");
    expect(stickyHeader.style.maxWidth).toBe("119px");
  });

  it("preserves existing sticky Description width constraints", () => {
    const row = document.createElement("tr");
    const activityHeader = document.createElement("th");
    activityHeader.setAttribute("data-qa", "DLY_ACTV_CD");
    const descriptionHeader = document.createElement("th");
    descriptionHeader.setAttribute("data-qa", DESCRIPTION_COL_KEY);
    descriptionHeader.style.width = "180px";
    descriptionHeader.style.minWidth = "0";
    descriptionHeader.style.maxWidth = "180px";
    row.append(activityHeader, descriptionHeader);

    syncDescriptionHeaderCell(row);

    expect(descriptionHeader.style.width).toBe("180px");
    expect(descriptionHeader.style.minWidth).toBe("0px");
    expect(descriptionHeader.style.maxWidth).toBe("180px");
  });
});
