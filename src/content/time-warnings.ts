import { DAILY_ACTIVITY_QA } from "../shared/constants";
import { getRowCell } from "./grid-alignment";
import {
  getColumnHeaders,
  getColumnIndex,
  getColumnKey,
  getHeaderLabel,
} from "./grid-dom";
import {
  getPrimaryAndSummaryBodyRows,
  isExpandedDetailRow,
  isSummaryRow,
} from "./column-layout";
import { shouldWarnForMissingEvent } from "./time-entry-validation";

const STYLES_ID = "adv-time-warn-styles";
const TIME_WARN_BOUND_ATTR = "data-adv-time-warn-bound";
const EVENT_VALIDATION_BOUND_ATTR = "data-adv-event-validation-bound";
const DAY_TOTAL_QA_PATTERN = /^DAY_\d+_TIME_TOT$/;
const WEEK_TOTAL_QA_PATTERN = /^WEEK_\d+_TOT$/;
const EXCLUDED_QAS = new Set([
  "PY_PRD_AM",
  "MTHLY_AM",
  "ANUAL_AM",
  "HRLY_AM",
  "FREQ",
  "EFFECTIVE_DT",
  "EXPIRATION_DT",
]);

export function ensureTimeWarningStyles(root: Document = document) {
  if (root.getElementById(STYLES_ID)) return;

  const style = root.createElement("style");
  style.id = STYLES_ID;
  style.textContent = `
    td.adv-time-warn {
      background-color: orange !important;
    }

    td.adv-missing-event-warn {
      background-color: red !important;
    }
  `;
  root.head.appendChild(style);
}

export function applyTimeWarnings(
  grid: HTMLElement,
  mainHeaderRow: HTMLElement,
): void {
  if (!isTimeEntryWarningGrid(grid, mainHeaderRow)) {
    clearWarnings(grid);
    return;
  }

  const headers = getColumnHeaders(mainHeaderRow);
  const headerColumnCount = headers.length;
  const dayColumnIndices = headers
    .filter((header) =>
      /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/i.test(getColumnKey(header)),
    )
    .map(getColumnIndex);
  if (dayColumnIndices.length === 0) return;

  const eventHeader = headers.find(
    (header) => getHeaderLabel(header).toLowerCase() === "event",
  );
  const eventColumnIndex = eventHeader ? getColumnIndex(eventHeader) : null;
  clearWarnings(grid);

  getPrimaryAndSummaryBodyRows(grid, headerColumnCount).forEach((row) => {
    if (isSummaryRow(row) || isExpandedDetailRow(row, headerColumnCount))
      return;

    dayColumnIndices.forEach((columnIndex) => {
      const cell = getRowCell(row, columnIndex);
      if (!cell) return;
      bindWarningUpdate(cell, TIME_WARN_BOUND_ATTR, grid, mainHeaderRow);
      updateCellTimeWarning(cell);
    });

    if (eventColumnIndex === null) return;
    const eventCell = getRowCell(row, eventColumnIndex);
    if (!eventCell) return;
    bindWarningUpdate(
      eventCell,
      EVENT_VALIDATION_BOUND_ATTR,
      grid,
      mainHeaderRow,
    );
    const dayValues = dayColumnIndices
      .map((columnIndex) => getRowCell(row, columnIndex))
      .filter((cell): cell is HTMLElement => cell !== undefined)
      .map(getCellDisplayValue);
    if (shouldWarnForMissingEvent(getCellDisplayValue(eventCell), dayValues)) {
      eventCell.classList.add("adv-missing-event-warn");
    }
  });
}

export function isTimeEntryWarningGrid(
  grid: HTMLElement,
  mainHeaderRow: HTMLElement,
): boolean {
  const headers = getColumnHeaders(mainHeaderRow);
  const headerQas = headers
    .map((header) => header.getAttribute("data-qa")?.trim() ?? "")
    .filter(Boolean);
  if (
    headerQas.length === 0 ||
    headerQas.some((qa) => EXCLUDED_QAS.has(qa)) ||
    !headerQas.some((qa) => DAY_TOTAL_QA_PATTERN.test(qa))
  ) {
    return false;
  }
  if (
    headerQas.includes(DAILY_ACTIVITY_QA) ||
    headerQas.some((qa) => WEEK_TOTAL_QA_PATTERN.test(qa)) ||
    headerQas.includes("DAY_TOTAL_HOURS")
  ) {
    return true;
  }
  return getPrimaryAndSummaryBodyRows(grid, headers.length).some(isSummaryRow);
}

function bindWarningUpdate(
  cell: HTMLElement,
  attribute: string,
  grid: HTMLElement,
  mainHeaderRow: HTMLElement,
) {
  const input = cell.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    "input, textarea",
  );
  if (!input || input.getAttribute(attribute) === "true") return;

  input.setAttribute(attribute, "true");
  input.addEventListener("blur", () => {
    grid.ownerDocument.defaultView?.setTimeout(
      () => applyTimeWarnings(grid, mainHeaderRow),
      0,
    );
  });
}

function updateCellTimeWarning(cell: HTMLElement): void {
  const value = getCellDisplayValue(cell);
  cell.classList.toggle(
    "adv-time-warn",
    !(
      value === "" ||
      value === "0" ||
      value === "-" ||
      /:(?:00|15|30|45)$/.test(value)
    ),
  );
}

function clearWarnings(grid: HTMLElement) {
  grid
    .querySelectorAll<HTMLElement>(".adv-time-warn, .adv-missing-event-warn")
    .forEach((cell) =>
      cell.classList.remove("adv-time-warn", "adv-missing-event-warn"),
    );
}

function getCellDisplayValue(cell: HTMLElement): string {
  const input = cell.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    "input, textarea",
  );
  if (input?.value) return input.value.trim();
  return cell.textContent?.trim() ?? "";
}
