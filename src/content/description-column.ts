import {
  DAILY_ACTIVITY_QA,
  DESCRIPTION_COL_KEY,
  DESCRIPTION_COL_LABEL,
} from "../shared/constants";
import { applyColumnWidth, getRowCell } from "./grid-alignment";
import { getColumnHeaders, getColumnIndex, getMainHeaderRow } from "./grid-dom";
import { getPrimaryAndSummaryBodyRows, isSummaryRow } from "./column-layout";

export function syncDescriptionColumns(
  grid: HTMLElement,
  headerRows: HTMLElement[],
  mainHeaderRow: HTMLElement,
  lookupMap: ReadonlyMap<string, string>,
  onMissingTask: (taskCode: string) => void,
) {
  let descriptionColumnIndex = -1;
  headerRows.forEach((headerRow) => {
    const descriptionHeader = syncDescriptionHeaderCell(headerRow);
    if (descriptionHeader && headerRow === mainHeaderRow) {
      descriptionColumnIndex = getColumnIndex(descriptionHeader);
    }
  });
  if (descriptionColumnIndex !== -1) {
    updateDescriptionCells(
      grid,
      descriptionColumnIndex,
      lookupMap,
      onMissingTask,
    );
  }
}

export function syncDescriptionHeaderCell(
  headerRow: HTMLElement,
): HTMLElement | undefined {
  const activityHeader = headerRow.querySelector<HTMLElement>(
    `th[data-qa="${DAILY_ACTIVITY_QA}"]`,
  );
  if (!activityHeader) return undefined;

  let descriptionHeader = headerRow.querySelector<HTMLElement>(
    `th[data-qa="${DESCRIPTION_COL_KEY}"]`,
  );
  const root = headerRow.ownerDocument;
  if (!descriptionHeader) {
    descriptionHeader = root.createElement("th");
    descriptionHeader.setAttribute("data-qa", DESCRIPTION_COL_KEY);
    descriptionHeader.setAttribute("role", "columnheader");
    descriptionHeader.setAttribute("scope", "col");
  }
  descriptionHeader.style.cssText =
    "padding: 1px; white-space: nowrap; font-weight: bold; vertical-align: middle;";
  descriptionHeader.replaceChildren();

  const titleWrapper = root.createElement("div");
  titleWrapper.setAttribute("role", "presentation");
  titleWrapper.style.cssText =
    "display: flex; align-items: center; box-sizing: border-box; height: 44px; padding: 15px 20px;";
  const title = root.createElement("span");
  title.setAttribute("role", "presentation");
  title.setAttribute("data-qa", "headerCellTitle");
  title.style.display = "block";
  title.textContent = DESCRIPTION_COL_LABEL;
  titleWrapper.appendChild(title);
  descriptionHeader.appendChild(titleWrapper);

  const nextHeader = activityHeader.nextElementSibling;
  if (nextHeader !== descriptionHeader) {
    headerRow.insertBefore(descriptionHeader, nextHeader);
  }
  return descriptionHeader;
}

export function clearLegacyBodyColumnWidths(
  grid: HTMLElement,
  headerRow: HTMLElement,
) {
  const headers = getColumnHeaders(headerRow);
  getPrimaryAndSummaryBodyRows(grid, headers.length).forEach((row) => {
    headers.forEach((_, index) => {
      const cell = getRowCell(row, index + 1);
      if (
        cell?.style.minWidth === "0px" &&
        cell.style.maxWidth.endsWith("px")
      ) {
        cell.style.removeProperty("width");
        cell.style.removeProperty("min-width");
        cell.style.removeProperty("max-width");
      }
    });
  });
}

export function syncStickyHeaderColumnWidths(
  sourceHeaderRow: HTMLElement,
  stickyHeaderRow: HTMLElement | null,
) {
  if (!stickyHeaderRow) return;
  const stickyHeaders = getColumnHeaders(stickyHeaderRow);
  getColumnHeaders(sourceHeaderRow).forEach((sourceHeader, index) => {
    const stickyHeader = stickyHeaders[index];
    if (stickyHeader) {
      applyColumnWidth(
        stickyHeader,
        sourceHeader.getBoundingClientRect().width,
      );
    }
  });
}

function updateDescriptionCells(
  grid: HTMLElement,
  descriptionColumnIndex: number,
  lookupMap: ReadonlyMap<string, string>,
  onMissingTask: (taskCode: string) => void,
) {
  const mainHeaderRow = getMainHeaderRow(grid);
  const headerColumnCount = mainHeaderRow
    ? getColumnHeaders(mainHeaderRow).length
    : 0;
  getPrimaryAndSummaryBodyRows(grid, headerColumnCount).forEach((row) => {
    if (isSummaryRow(row)) {
      syncSummaryDescriptionCell(row, descriptionColumnIndex);
      return;
    }
    let descriptionCell = row.querySelector<HTMLElement>(
      `td[data-qa="${DESCRIPTION_COL_KEY}"]`,
    );
    const root = row.ownerDocument;
    if (!descriptionCell) {
      descriptionCell = root.createElement("td");
      descriptionCell.setAttribute("data-qa", DESCRIPTION_COL_KEY);
    } else if (descriptionCell.parentElement === row) {
      row.removeChild(descriptionCell);
    }

    const activityCell = row.children[descriptionColumnIndex - 2] as
      | HTMLElement
      | undefined;
    const activityValue = activityCell ? getCellDisplayValue(activityCell) : "";
    const hasMatch = activityValue.length > 0 && lookupMap.has(activityValue);
    if (activityValue.length > 0 && lookupMap.size > 0 && !hasMatch) {
      onMissingTask(activityValue);
    }
    descriptionCell.textContent = hasMatch
      ? (lookupMap.get(activityValue) ?? "")
      : "";
    descriptionCell.style.cssText = "padding: 0.3571rem 1.4286rem;";
    descriptionCell.classList.add("adv-description");
    row.insertBefore(
      descriptionCell,
      row.children[descriptionColumnIndex - 1] ?? null,
    );
  });
}

function syncSummaryDescriptionCell(
  row: HTMLElement,
  descriptionColumnIndex: number,
) {
  let descriptionCell = row.querySelector<HTMLTableCellElement>(
    `td[data-qa="${DESCRIPTION_COL_KEY}"]`,
  );
  if (!descriptionCell) {
    descriptionCell = row.ownerDocument.createElement("td");
    descriptionCell.setAttribute("data-qa", DESCRIPTION_COL_KEY);
    const nextCell = getRowCell(row, descriptionColumnIndex);
    if (nextCell?.parentElement === row) {
      descriptionCell.className = nextCell.className;
      row.insertBefore(descriptionCell, nextCell);
    } else {
      const fallbackCell = row.lastElementChild;
      descriptionCell.className =
        fallbackCell instanceof HTMLElement ? fallbackCell.className : "";
      row.appendChild(descriptionCell);
    }
  }
  descriptionCell.textContent = "";
}

function getCellDisplayValue(cell: HTMLElement): string {
  const input = cell.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    "input, textarea",
  );
  return input?.value ? input.value.trim() : (cell.textContent?.trim() ?? "");
}
