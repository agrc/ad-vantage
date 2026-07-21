import { describe, expect, it } from "vitest";
import { applyColumnWidth, getRowCell } from "./grid-alignment";

function createRow(markup: string): HTMLTableRowElement {
  const table = document.createElement("table");
  table.innerHTML = `<tbody><tr>${markup}</tr></tbody>`;
  return table.querySelector("tr")!;
}

describe("getRowCell", () => {
  it("looks up logical columns across hidden leading cells", () => {
    const row = createRow(
      '<td style="display:none">select</td><td style="display:none">line</td><td data-key="activity">activity</td><td data-key="event">event</td>',
    );

    expect(getRowCell(row, 1)?.textContent).toBe("select");
    expect(getRowCell(row, 3)?.getAttribute("data-key")).toBe("activity");
    expect(getRowCell(row, 4)?.getAttribute("data-key")).toBe("event");
  });

  it("resolves cells covered by a colspan", () => {
    const row = createRow(
      '<td colspan="2" data-key="summary">summary</td><td data-key="date">date</td>',
    );

    expect(getRowCell(row, 1)?.getAttribute("data-key")).toBe("summary");
    expect(getRowCell(row, 2)?.getAttribute("data-key")).toBe("summary");
    expect(getRowCell(row, 3)?.getAttribute("data-key")).toBe("date");
  });
});

describe("applyColumnWidth", () => {
  it("constrains a single-column cell to the header width", () => {
    const row = createRow('<td data-key="description">description</td>');
    const cell = row.querySelector<HTMLElement>("td")!;

    expect(applyColumnWidth(cell, 88)).toBe(true);
    expect(cell.style.width).toBe("88px");
    expect(cell.style.minWidth).toBe("0");
    expect(cell.style.maxWidth).toBe("88px");
  });

  it("leaves colspan cells unchanged", () => {
    const row = createRow('<td colspan="2">summary</td>');
    const cell = row.querySelector<HTMLElement>("td")!;

    expect(applyColumnWidth(cell, 88)).toBe(false);
    expect(cell.style.width).toBe("");
  });

  it("clears prior width constraints when preserving a native column width", () => {
    const row = createRow(
      '<td style="width: 88px; min-width: 0; max-width: 88px">activity</td>',
    );
    const cell = row.querySelector<HTMLElement>("td")!;

    expect(applyColumnWidth(cell, 88, true)).toBe(true);
    expect(cell.style.width).toBe("");
    expect(cell.style.minWidth).toBe("");
    expect(cell.style.maxWidth).toBe("");
  });
});
