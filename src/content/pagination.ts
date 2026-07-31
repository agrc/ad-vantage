import {
  decidePaginationAutomation,
  type PaginationAutomationCandidate,
} from "./pagination-automation";
import {
  getColumnHeaders,
  getColumnKey,
  getMainHeaderRow,
  isEnhanceableGrid,
} from "./grid-dom";

const PAGINATION_BUTTON_SELECTOR = [
  'button[data-qa-id*=".pagination."]',
  'button[data-qa*="records"]',
  'button[title*="records"]',
  'button[aria-label*="records per page"]',
].join(", ");
const PAGINATION_SCOPE_KEY_PATTERN = /^(.*)\.pagination\./i;
const PAGINATION_ID_COUNT_PATTERN = /\.pagination\.(\d+)Records\b/i;
const PAGINATION_LABEL_COUNT_PATTERN = /(\d+)\s*records(?:\s+per\s+page)?/i;
const PAGINATION_TEXT_COUNT_PATTERN = /^(\d+)$/;
const DEFAULT_PAGINATION_COUNT = 20;
const MIN_AUTO_PAGINATION_COUNT = 50;
const PAGINATION_CLICK_COOLDOWN_MS = 1500;

interface PaginationOption {
  button: HTMLButtonElement;
  count: number;
}

export interface PaginationAutomationController {
  sync: (grid: HTMLElement) => void;
}

export function createPaginationAutomationController(options?: {
  isVisible?: (element: HTMLElement) => boolean;
  now?: () => number;
}): PaginationAutomationController {
  const isVisible =
    options?.isVisible ??
    ((element: HTMLElement) => element.getClientRects().length > 0);
  const now = options?.now ?? Date.now;
  const recentClicks = new Map<string, { count: number; time: number }>();
  const lastEligibleSignatures = new Map<string, string | null>();

  return {
    sync(grid) {
      const buttons = getPaginationButtonsForGrid(grid, isVisible);
      if (buttons.length === 0) return;

      const pageOptions = buttons
        .map((button) => {
          const count = parsePaginationCount(button);
          return count === null ? null : { button, count };
        })
        .filter((option): option is PaginationOption => option !== null)
        .sort((left, right) => right.count - left.count);
      const highestOption = pageOptions.find(
        ({ count, button }) =>
          count >= MIN_AUTO_PAGINATION_COUNT &&
          count !== DEFAULT_PAGINATION_COUNT &&
          !isElementDisabled(button),
      );

      if (!highestOption || isPaginationOptionCurrent(highestOption.button))
        return;

      const scopeKey = getPaginationScopeKey(grid, buttons);
      const currentOption = pageOptions.find(({ button }) =>
        isPaginationOptionCurrent(button),
      );
      const candidate: PaginationAutomationCandidate = {
        scopeKey,
        currentCount: currentOption?.count ?? null,
        highestEligibleCount: highestOption.count,
        eligibleCounts: pageOptions
          .filter(
            ({ count, button }) =>
              count >= MIN_AUTO_PAGINATION_COUNT &&
              count !== DEFAULT_PAGINATION_COUNT &&
              !isElementDisabled(button),
          )
          .map(({ count }) => count),
      };
      const currentTime = now();
      pruneRecentClicks(recentClicks, currentTime);
      const decision = decidePaginationAutomation({
        candidate,
        previousEligibleSignature: lastEligibleSignatures.get(scopeKey) ?? null,
        recentAction: recentClicks.get(scopeKey),
        defaultCount: DEFAULT_PAGINATION_COUNT,
        cooldownMs: PAGINATION_CLICK_COOLDOWN_MS,
        now: currentTime,
      });

      lastEligibleSignatures.set(scopeKey, decision.eligibleSignature);
      if (
        !decision.shouldClick ||
        !grid.ownerDocument.contains(highestOption.button)
      )
        return;

      recentClicks.set(scopeKey, {
        count: highestOption.count,
        time: currentTime,
      });
      highestOption.button.click();
    },
  };
}

export function parsePaginationCount(button: HTMLButtonElement): number | null {
  const candidates = [
    button.getAttribute("data-qa-id"),
    button.getAttribute("data-qa"),
    button.getAttribute("title"),
    button.getAttribute("aria-label"),
    button.textContent,
  ];

  for (const candidate of candidates) {
    const normalized = candidate?.replace(/\s+/g, " ").trim() ?? "";
    const match =
      normalized.match(PAGINATION_ID_COUNT_PATTERN) ??
      normalized.match(PAGINATION_LABEL_COUNT_PATTERN) ??
      normalized.match(PAGINATION_TEXT_COUNT_PATTERN);
    if (!match) continue;

    const count = Number.parseInt(match[1], 10);
    if (!Number.isNaN(count)) return count;
  }

  return null;
}

function getPaginationButtonsForGrid(
  grid: HTMLElement,
  isVisible: (element: HTMLElement) => boolean,
): HTMLButtonElement[] {
  const scope = getPaginationScopeElement(grid);
  if (!scope) return [];

  return Array.from(
    scope.querySelectorAll<HTMLButtonElement>(PAGINATION_BUTTON_SELECTOR),
  ).filter(
    (button) => isVisible(button) && parsePaginationCount(button) !== null,
  );
}

function getPaginationScopeElement(grid: HTMLElement): HTMLElement | null {
  let fallback: HTMLElement | null = null;

  for (
    let ancestor = grid.parentElement;
    ancestor && ancestor !== grid.ownerDocument.body;
    ancestor = ancestor.parentElement
  ) {
    const buttons = ancestor.querySelectorAll(PAGINATION_BUTTON_SELECTOR);
    if (buttons.length === 0) continue;

    fallback ??= ancestor;
    const grids = Array.from(
      ancestor.querySelectorAll<HTMLElement>('div[role="grid"]'),
    ).filter(isEnhanceableGrid);
    if (grids.length === 1 && grids[0] === grid) return ancestor;
  }

  return fallback;
}

function getPaginationScopeKey(
  grid: HTMLElement,
  buttons: HTMLButtonElement[],
): string {
  for (const button of buttons) {
    const match = button
      .getAttribute("data-qa-id")
      ?.match(PAGINATION_SCOPE_KEY_PATTERN);
    if (match?.[1]) return match[1];
  }

  const mainHeaderRow = getMainHeaderRow(grid);
  if (mainHeaderRow) {
    const headerKey = getColumnHeaders(mainHeaderRow)
      .map(getColumnKey)
      .filter(Boolean)
      .join("|");
    if (headerKey) return `grid:${headerKey}`;
  }

  const gridIndex = Array.from(
    grid.ownerDocument.querySelectorAll<HTMLElement>('div[role="grid"]'),
  )
    .filter(isEnhanceableGrid)
    .indexOf(grid);
  return `grid-index:${gridIndex}`;
}

function isPaginationOptionCurrent(button: HTMLButtonElement): boolean {
  return (
    button.getAttribute("aria-current") === "true" ||
    button.getAttribute("aria-pressed") === "true"
  );
}

function isElementDisabled(button: HTMLButtonElement): boolean {
  return button.disabled || button.getAttribute("aria-disabled") === "true";
}

function pruneRecentClicks(
  recentClicks: Map<string, { count: number; time: number }>,
  now: number,
) {
  const cutoff = now - PAGINATION_CLICK_COOLDOWN_MS;
  recentClicks.forEach((value, key) => {
    if (value.time < cutoff) recentClicks.delete(key);
  });
}
