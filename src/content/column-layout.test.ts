import { describe, expect, it } from "vitest";
import {
  applyColumnVisibility,
  applyFrozenColumns,
  getPrimaryAndSummaryBodyRows,
} from "./column-layout";

function createGrid(): HTMLTableElement {
  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th data-qa="DLY_ACTV_CD">Daily Activity</th>
        <th><span data-qa-id="grid.headerCellTitle">Mon 07/27</span></th>
        <th><span data-qa-id="grid.headerCellTitle">Tue 07/28</span></th>
      </tr>
    </thead>
    <tbody>
      <tr data-row="entry"><td>Task</td><td>1</td><td>2</td></tr>
      <tr data-row="summary"><td colspan="2">Total Hours</td><td>3</td></tr>
      <tr data-row="detail"><td colspan="3"><button>Detail action</button></td></tr>
    </tbody>
  `;
  return table;
}

describe("applyColumnVisibility", () => {
  it("hides columns by grouped weekday key", () => {
    const grid = createGrid();
    const headerRow = grid.querySelector<HTMLElement>("thead tr")!;

    applyColumnVisibility(grid, headerRow, ["Mon"]);

    expect(headerRow.children[1].classList).toContain("adv-hidden");
    expect(
      grid.querySelector('[data-row="entry"]')?.children[1].classList,
    ).toContain("adv-hidden");
  });

  it("contracts and restores summary colspans as preferences change", () => {
    const grid = createGrid();
    const headerRow = grid.querySelector<HTMLElement>("thead tr")!;
    const summaryCell = grid.querySelector<HTMLTableCellElement>(
      '[data-row="summary"] td',
    )!;

    applyColumnVisibility(grid, headerRow, ["DLY_ACTV_CD"]);
    expect(summaryCell.colSpan).toBe(1);
    expect(summaryCell.getAttribute("data-adv-original-colspan")).toBe("2");

    applyColumnVisibility(grid, headerRow, []);
    expect(summaryCell.colSpan).toBe(2);
    expect(summaryCell.hasAttribute("data-adv-original-colspan")).toBe(false);
  });

  it("leaves expanded detail panels visible and excludes them from body rows", () => {
    const grid = createGrid();
    const headerRow = grid.querySelector<HTMLElement>("thead tr")!;
    const detailRow = grid.querySelector<HTMLElement>('[data-row="detail"]')!;
    const detailCell = detailRow.querySelector<HTMLElement>("td")!;
    detailCell.classList.add("adv-hidden", "adv-frozen");
    detailCell.style.display = "none";

    applyColumnVisibility(grid, headerRow, ["DLY_ACTV_CD"]);

    expect(detailCell.style.display).toBe("");
    expect(detailCell.classList).not.toContain("adv-hidden");
    expect(detailCell.classList).not.toContain("adv-frozen");
    expect(getPrimaryAndSummaryBodyRows(grid, 3)).not.toContain(detailRow);
  });
});

describe("applyFrozenColumns", () => {
  it("accumulates offsets and leaves expanded detail rows unfrozen", () => {
    const grid = createGrid();
    const headerRow = grid.querySelector<HTMLElement>("thead tr")!;
    const headers = Array.from(headerRow.children) as HTMLElement[];
    headers.forEach((header, index) => {
      Object.defineProperty(header, "getBoundingClientRect", {
        value: () => ({ width: index === 0 ? 80 : 40 }),
      });
    });

    applyFrozenColumns(grid, headerRow, ["DLY_ACTV_CD", "Mon"]);

    expect((headers[0] as HTMLElement).style.left).toBe("0px");
    expect((headers[1] as HTMLElement).style.left).toBe("80px");
    expect(
      (grid.querySelector('[data-row="entry"]')?.children[1] as HTMLElement)
        .style.left,
    ).toBe("80px");
    expect(
      grid.querySelector('[data-row="detail"] td')?.classList,
    ).not.toContain("adv-frozen");
  });
});
