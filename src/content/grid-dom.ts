const MODAL_ANCESTOR_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [aria-modal="true"]';
const DAILY_ACTIVITY_HEADER_SELECTOR = '[data-qa="DLY_ACTV_CD"]';

export function getColumnHeaders(headerRow: HTMLElement): HTMLElement[] {
  return Array.from(headerRow.querySelectorAll<HTMLElement>("th"));
}

export function getHeaderRows(grid: HTMLElement): HTMLElement[] {
  return Array.from(grid.querySelectorAll<HTMLElement>("thead tr"));
}

export function getMainHeaderRow(grid: HTMLElement): HTMLElement | null {
  if (grid.matches("table")) {
    return grid.querySelector<HTMLElement>("thead tr");
  }

  return (
    grid.querySelector<HTMLElement>('table[data-qa="tableGrid"] thead tr') ??
    grid.querySelector<HTMLElement>("table thead tr")
  );
}

export function getStickyHeaderRow(grid: HTMLElement): HTMLElement | null {
  if (!(grid instanceof HTMLTableElement)) return null;

  const stickyHeader = grid.parentElement?.previousElementSibling;
  if (
    !(stickyHeader instanceof HTMLElement) ||
    stickyHeader.getAttribute("data-qa") !== "stickyTableGrid"
  ) {
    return null;
  }

  return stickyHeader.querySelector<HTMLElement>("table thead tr");
}

export function getEnhanceableGrids(
  root: ParentNode = document,
): HTMLElement[] {
  return getGrids(root);
}

function getGrids(root: ParentNode): HTMLElement[] {
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(
      'div[role="grid"], table[data-qa="tableGrid"], table',
    ),
  );
  const grids: HTMLElement[] = [];

  candidates.forEach((candidate) => {
    if (candidate.closest('[data-qa="stickyTableGrid"]')) return;
    if (!isEnhanceableGrid(candidate) || !getMainHeaderRow(candidate)) return;

    const containingGrid = candidate.closest<HTMLElement>('div[role="grid"]');
    const grid = containingGrid ?? candidate;
    if (!grids.includes(grid)) grids.push(grid);
  });

  return grids;
}

export function isEnhanceableGrid(grid: HTMLElement): boolean {
  return !grid.closest(MODAL_ANCESTOR_SELECTOR);
}

export function isDailyActivityGrid(grid: HTMLElement): boolean {
  return Boolean(
    getMainHeaderRow(grid)?.querySelector(DAILY_ACTIVITY_HEADER_SELECTOR),
  );
}

export function getColumnKey(th: HTMLElement): string {
  const titleElement = th.querySelector<HTMLElement>(
    '[data-qa-id$=".headerCellTitle"]',
  );
  const text = (titleElement ?? th).textContent?.trim() ?? "";
  const dateMatch = text.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/i);
  if (dateMatch) return dateMatch[1];

  return th.getAttribute("data-qa") ?? text;
}

export function getHeaderLabel(th: HTMLElement): string {
  const titleElement = th.querySelector<HTMLElement>(
    '[data-qa-id$=".headerCellTitle"]',
  );
  return (titleElement ?? th).textContent?.trim() ?? "";
}

export function getColumnIndex(th: HTMLElement): number {
  if (!th.parentElement) return 0;
  return Array.from(th.parentElement.children).indexOf(th) + 1;
}
