import { getCellColumnSpan, getRowCell } from "./grid-alignment";
import { getColumnHeaders, getColumnIndex, getColumnKey } from "./grid-dom";

const HIDDEN_COLSPAN_ATTR = "data-adv-original-colspan";
const SUMMARY_LABELS = new Set(["Total Hours", "Scheduled Hours"]);

export function applyColumnVisibility(
  grid: HTMLElement,
  headerRow: HTMLElement,
  hiddenColumnKeys: readonly string[],
) {
  resetHiddenColumns(grid);

  const headers = getColumnHeaders(headerRow);
  const headerColumnCount = headers.length;
  unhideExpandedDetailCells(grid, headerColumnCount);
  const hiddenColumnIndexes = headers.reduce<number[]>((indexes, header) => {
    if (hiddenColumnKeys.includes(getColumnKey(header))) {
      indexes.push(getColumnIndex(header));
    }
    return indexes;
  }, []);

  if (hiddenColumnIndexes.length === 0) return;
  getRowsForCellMutations(grid, headerColumnCount).forEach((row) => {
    applyHiddenColumnsToRow(row, hiddenColumnIndexes, headerColumnCount);
  });
}

export function applyFrozenColumns(
  grid: HTMLElement,
  headerRow: HTMLElement,
  frozenColumnKeys: readonly string[],
) {
  grid.querySelectorAll<HTMLElement>(".adv-frozen").forEach((cell) => {
    for (const property of [
      "position",
      "left",
      "top",
      "z-index",
      "background",
      "background-color",
    ]) {
      cell.style.removeProperty(property);
    }
    cell.classList.remove("adv-frozen");
  });
  if (frozenColumnKeys.length === 0) return;

  const headers = getColumnHeaders(headerRow);
  const headerColumnCount = headers.length;
  let accumulatedWidth = 0;
  headers.forEach((header) => {
    if (!frozenColumnKeys.includes(getColumnKey(header))) return;

    const width = header.getBoundingClientRect().width;
    setColumnFrozen(
      grid,
      getColumnIndex(header),
      accumulatedWidth,
      headerColumnCount,
    );
    accumulatedWidth += width;
  });
}

export function prepareGridForFrozenColumns(grid: HTMLElement) {
  grid.style.position = "relative";
  grid.style.isolation = "isolate";
}

export function isSummaryRow(row: HTMLElement): boolean {
  return Array.from(row.children).some((cell) => {
    if (!(cell instanceof HTMLTableCellElement)) return false;
    return SUMMARY_LABELS.has(cell.textContent?.trim() ?? "");
  });
}

export function isExpandedDetailRow(
  row: HTMLElement,
  headerColumnCount: number,
): boolean {
  if (isSummaryRow(row)) return false;
  const cells = Array.from(row.children).filter(
    (child): child is HTMLTableCellElement =>
      child instanceof HTMLTableCellElement,
  );
  if (cells.length !== 1) return false;

  const [cell] = cells;
  return (
    cell.colSpan >= Math.max(2, headerColumnCount - 1) && hasDetailContent(cell)
  );
}

export function isExpandedDetailCell(
  cell: HTMLElement,
  row: HTMLElement,
  headerColumnCount: number,
): boolean {
  if (!(cell instanceof HTMLTableCellElement) || isSummaryRow(row))
    return false;
  if (isExpandedDetailRow(row, headerColumnCount)) return true;
  return (
    cell.colSpan >= Math.max(2, headerColumnCount - 1) && hasDetailContent(cell)
  );
}

export function getPrimaryAndSummaryBodyRows(
  grid: HTMLElement,
  headerColumnCount: number,
): HTMLElement[] {
  return Array.from(grid.querySelectorAll<HTMLElement>("tbody tr")).filter(
    (row) => !isExpandedDetailRow(row, headerColumnCount),
  );
}

export function getRowsForCellMutations(
  grid: HTMLElement,
  headerColumnCount: number,
): HTMLElement[] {
  return [
    ...grid.querySelectorAll<HTMLElement>("thead tr"),
    ...getPrimaryAndSummaryBodyRows(grid, headerColumnCount),
  ];
}

function resetHiddenColumns(grid: HTMLElement) {
  grid
    .querySelectorAll<HTMLTableCellElement>(`[${HIDDEN_COLSPAN_ATTR}]`)
    .forEach((cell) => {
      const originalColSpan = Number.parseInt(
        cell.getAttribute(HIDDEN_COLSPAN_ATTR) ?? "",
        10,
      );
      if (!Number.isNaN(originalColSpan) && originalColSpan > 0) {
        cell.colSpan = originalColSpan;
      }
      cell.removeAttribute(HIDDEN_COLSPAN_ATTR);
    });
  grid.querySelectorAll<HTMLElement>(".adv-hidden").forEach((cell) => {
    cell.style.removeProperty("display");
    cell.classList.remove("adv-hidden");
  });
}

function setColumnFrozen(
  grid: HTMLElement,
  columnIndex: number,
  left: number,
  headerColumnCount: number,
) {
  getRowsForCellMutations(grid, headerColumnCount).forEach((row) => {
    const cell = getRowCell(row, columnIndex);
    if (!cell || isExpandedDetailCell(cell, row, headerColumnCount)) return;

    cell.style.position = "sticky";
    cell.style.left = `${left}px`;
    cell.style.zIndex = cell.tagName === "TH" ? "10" : "1";
    // Vantage hover and sort styles can reveal its duplicate hidden header layer.
    cell.style.setProperty(
      "background-color",
      getStickyCellBackground(cell, row, grid),
      "important",
    );
    cell.classList.add("adv-frozen");
  });
}

function getStickyCellBackground(
  cell: HTMLElement,
  row: HTMLElement,
  grid: HTMLElement,
): string {
  for (const element of [cell, row, grid, grid.ownerDocument.body]) {
    const backgroundColor =
      grid.ownerDocument.defaultView?.getComputedStyle(element).backgroundColor;
    if (backgroundColor && isOpaqueBackgroundColor(backgroundColor)) {
      return backgroundColor;
    }
  }
  return "#fff";
}

function isOpaqueBackgroundColor(backgroundColor: string | undefined): boolean {
  if (!backgroundColor || backgroundColor === "rgba(0, 0, 0, 0)") return false;
  if (!backgroundColor.startsWith("rgba(")) return true;

  const alpha = Number.parseFloat(
    backgroundColor.slice(backgroundColor.lastIndexOf(",") + 1),
  );
  return alpha >= 1;
}

function applyHiddenColumnsToRow(
  row: HTMLElement,
  hiddenColumnIndexes: number[],
  headerColumnCount: number,
) {
  let currentColumn = 1;
  let hiddenColumnCursor = 0;

  Array.from(row.children).forEach((cell) => {
    if (!(cell instanceof HTMLElement)) return;
    if (isExpandedDetailCell(cell, row, headerColumnCount)) return;

    const span = getCellColumnSpan(cell);
    const nextColumn = currentColumn + span;
    while (hiddenColumnIndexes[hiddenColumnCursor] < currentColumn) {
      hiddenColumnCursor += 1;
    }
    const hiddenColumnStart = hiddenColumnCursor;
    while (hiddenColumnIndexes[hiddenColumnCursor] < nextColumn) {
      hiddenColumnCursor += 1;
    }
    const hiddenCount = hiddenColumnCursor - hiddenColumnStart;

    if (hiddenCount > 0) {
      if (cell instanceof HTMLTableCellElement && hiddenCount < span) {
        cell.setAttribute(HIDDEN_COLSPAN_ATTR, String(span));
        cell.colSpan = span - hiddenCount;
      } else {
        cell.style.display = "none";
        cell.classList.add("adv-hidden");
      }
    }
    currentColumn = nextColumn;
  });
}

function unhideExpandedDetailCells(
  grid: HTMLElement,
  headerColumnCount: number,
) {
  grid
    .querySelectorAll<HTMLElement>("tbody td[colspan], tbody th[colspan]")
    .forEach((cell) => {
      const row = cell.parentElement;
      if (!(row instanceof HTMLElement)) return;
      if (!isExpandedDetailCell(cell, row, headerColumnCount)) return;

      cell.style.removeProperty("display");
      cell.classList.remove("adv-hidden", "adv-frozen");
      for (const property of [
        "position",
        "left",
        "top",
        "z-index",
        "background",
        "background-color",
      ]) {
        cell.style.removeProperty(property);
      }
    });
}

function hasDetailContent(cell: HTMLTableCellElement): boolean {
  return Boolean(
    cell.querySelector(
      '[role="tabpanel"], [role="tablist"], [data-qa-id*="cardGrid"], input, textarea, select, button',
    ),
  );
}
