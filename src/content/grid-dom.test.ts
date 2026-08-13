import { describe, expect, it } from "vitest";
import {
  getColumnIndex,
  getColumnKey,
  getEnhanceableGrids,
  getMainHeaderRow,
  getStickyHeaderRow,
  isDailyActivityGrid,
} from "./grid-dom";

describe("grid discovery", () => {
  it("deduplicates nested grid tables and excludes modal and sticky copies", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div data-qa="stickyTableGrid"><table><thead><tr><th>Sticky</th></tr></thead></table></div>
      <div role="grid"><table data-qa="tableGrid"><thead><tr><th>Main</th></tr></thead></table></div>
      <div role="dialog"><table><thead><tr><th>Modal</th></tr></thead></table></div>
    `;

    const grids = getEnhanceableGrids(root);

    expect(grids).toHaveLength(1);
    expect(grids[0].getAttribute("role")).toBe("grid");
    expect(getMainHeaderRow(grids[0])?.textContent).toBe("Main");
  });

  it("identifies the Daily Activity tab grid", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div role="grid"><table><thead><tr><th data-qa="DLY_ACTV_CD">Daily Activity</th></tr></thead></table></div>
      <div role="grid"><table><thead><tr><th>Other</th></tr></thead></table></div>
    `;
    const [dailyActivityGrid, otherGrid] = getEnhanceableGrids(root);

    expect(isDailyActivityGrid(dailyActivityGrid)).toBe(true);
    expect(isDailyActivityGrid(otherGrid)).toBe(false);
  });

  it("finds the sticky sibling header for a table grid", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div data-qa="stickyTableGrid"><table><thead><tr><th>Sticky</th></tr></thead></table></div>
      <div><table data-qa="tableGrid"><thead><tr><th>Main</th></tr></thead></table></div>
    `;
    const table = root.querySelector<HTMLTableElement>(
      'table[data-qa="tableGrid"]',
    )!;

    expect(getStickyHeaderRow(table)?.textContent).toBe("Sticky");
  });
});

describe("column metadata", () => {
  it("groups dated headers by weekday and prefers data-qa for other columns", () => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <th><span data-qa-id="grid.headerCellTitle">Mon 07/27</span></th>
      <th data-qa="DLY_ACTV_CD">Daily Activity</th>
    `;
    const headers = Array.from(row.children) as HTMLElement[];

    expect(getColumnKey(headers[0])).toBe("Mon");
    expect(getColumnKey(headers[1])).toBe("DLY_ACTV_CD");
    expect(getColumnIndex(headers[1])).toBe(2);
  });
});
