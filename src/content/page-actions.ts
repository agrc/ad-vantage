import { DAILY_ACTIVITY_QA } from "../shared/constants";
import {
  getColumnHeaders,
  getEnhanceableGrids,
  getMainHeaderRow,
} from "./grid-dom";

export const EDITABLE_TIMESHEET_ACTION_SELECTOR = [
  'button[data-qa$=".viewActions.saveAndClose"]',
  'button[data-qa$=".viewActions.save"]',
].join(", ");

const MENU_TRIGGER_SELECTOR =
  'button[data-qa-id$=".viewMenu.pageLevelThreedotMenu"]';
const DAILY_ACTIVITY_MENU_TRIGGER_SELECTOR =
  'button[data-qa-id$="rs10TIMEI_DOC_DACTview.viewMenu.pageLevelThreedotMenu"]';
const MENU_ITEM_SELECTOR = [
  'button[role="menuitem"][data-qa$=".additionalActionsMenu.LoadTimesheet"]',
  'button[role="menuitem"][data-qa-id$=".additionalActionsMenu.LoadTimesheet"]',
].join(", ");
const SHORTCUT_ATTR = "data-adv-update-timesheet-shortcut";
const STYLES_ID = "adv-update-timesheet-shortcut-styles";
const TIMESHEET_TITLE_PATTERN = /Timesheet \(TIMEI\)/i;
const REENABLE_DELAY_MS = 250;

export interface UpdateTimesheetShortcutController {
  sync: () => void;
  schedule: () => void;
}

export function createUpdateTimesheetShortcutController(
  root: Document = document,
): UpdateTimesheetShortcutController {
  let positionFrame: number | null = null;

  const remove = () => {
    if (positionFrame !== null) {
      root.defaultView?.cancelAnimationFrame(positionFrame);
      positionFrame = null;
    }
    root
      .querySelectorAll<HTMLElement>(`button[${SHORTCUT_ATTR}="true"]`)
      .forEach((shortcut) => shortcut.remove());
  };

  const sync = () => {
    ensureStyles(root);
    const menuTrigger = getMenuTrigger(root);
    if (
      !TIMESHEET_TITLE_PATTERN.test(root.title) ||
      !menuTrigger ||
      !hasDailyActivityGrid(root) ||
      !hasVisibleEnabledEditableTimesheetAction(root, isVisible)
    ) {
      remove();
      return;
    }

    const shortcut = ensureShortcut(root, menuTrigger, sync);
    syncAppearance(root, shortcut, menuTrigger);
    positionShortcut(root, shortcut, menuTrigger);
  };

  return {
    sync,
    schedule() {
      if (positionFrame !== null || !root.defaultView) return;
      positionFrame = root.defaultView.requestAnimationFrame(() => {
        positionFrame = null;
        sync();
      });
    },
  };
}

export function hasVisibleEnabledEditableTimesheetAction(
  root: ParentNode,
  isVisible: (element: HTMLElement) => boolean,
): boolean {
  return Array.from(
    root.querySelectorAll<HTMLButtonElement>(
      EDITABLE_TIMESHEET_ACTION_SELECTOR,
    ),
  ).some(
    (button) =>
      isVisible(button) &&
      !button.disabled &&
      button.getAttribute("aria-disabled") !== "true",
  );
}

function getMenuTrigger(root: Document): HTMLButtonElement | null {
  const trigger =
    root.querySelector<HTMLButtonElement>(
      DAILY_ACTIVITY_MENU_TRIGGER_SELECTOR,
    ) ?? root.querySelector<HTMLButtonElement>(MENU_TRIGGER_SELECTOR);
  return trigger && root.contains(trigger) ? trigger : null;
}

function hasDailyActivityGrid(root: Document): boolean {
  return getEnhanceableGrids(root).some((grid) => {
    const headerRow = getMainHeaderRow(grid);
    return Boolean(
      headerRow &&
      getColumnHeaders(headerRow).some(
        (header) => header.getAttribute("data-qa") === DAILY_ACTIVITY_QA,
      ),
    );
  });
}

function ensureShortcut(
  root: Document,
  menuTrigger: HTMLButtonElement,
  sync: () => void,
): HTMLButtonElement {
  const shortcuts = Array.from(
    root.querySelectorAll<HTMLButtonElement>(`button[${SHORTCUT_ATTR}="true"]`),
  );
  const existingShortcut = shortcuts[0];
  shortcuts.slice(1).forEach((shortcut) => shortcut.remove());
  if (existingShortcut) return existingShortcut;

  const shortcut = root.createElement("button");
  shortcut.type = "button";
  shortcut.setAttribute(SHORTCUT_ATTR, "true");
  shortcut.className = "adv-update-timesheet-shortcut";
  shortcut.textContent = "Update Timesheet";
  shortcut.setAttribute("aria-label", "Update Timesheet");
  positionShortcut(root, shortcut, menuTrigger);
  shortcut.addEventListener("click", async () => {
    if (shortcut.disabled) return;

    shortcut.disabled = true;
    shortcut.setAttribute("aria-busy", "true");
    try {
      const currentTrigger = getMenuTrigger(root);
      if (currentTrigger) await triggerNativeAction(root, currentTrigger);
    } finally {
      root.defaultView?.setTimeout(() => {
        shortcut.disabled = false;
        shortcut.removeAttribute("aria-busy");
        sync();
      }, REENABLE_DELAY_MS);
    }
  });
  return shortcut;
}

function syncAppearance(
  root: Document,
  shortcut: HTMLButtonElement,
  menuTrigger: HTMLButtonElement,
) {
  const referenceButton =
    root.querySelector<HTMLButtonElement>(EDITABLE_TIMESHEET_ACTION_SELECTOR) ??
    menuTrigger;
  shortcut.className = `${referenceButton.className} adv-update-timesheet-shortcut`;

  const menuItem = getMenuItem(root);
  shortcut.disabled = Boolean(menuItem && isDisabled(menuItem));
}

function positionShortcut(
  root: Document,
  shortcut: HTMLButtonElement,
  menuTrigger: HTMLButtonElement,
) {
  const container = menuTrigger.parentElement;
  if (!container || !root.contains(container)) {
    shortcut.remove();
    return;
  }

  if (
    shortcut.parentElement !== container ||
    shortcut.nextElementSibling !== menuTrigger
  ) {
    container.insertBefore(shortcut, menuTrigger);
  }
  shortcut.style.removeProperty("top");
  shortcut.style.removeProperty("left");
  shortcut.style.removeProperty("visibility");
}

async function triggerNativeAction(
  root: Document,
  menuTrigger: HTMLButtonElement,
): Promise<boolean> {
  const existingItem = getMenuItem(root);
  if (existingItem && !isDisabled(existingItem)) {
    existingItem.click();
    return true;
  }
  if (!root.contains(menuTrigger)) return false;

  menuTrigger.click();
  const menuItem = await waitForMenuItem(root, 1200);
  if (!menuItem || isDisabled(menuItem)) {
    if (
      root.contains(menuTrigger) &&
      menuTrigger.getAttribute("aria-expanded") === "true"
    ) {
      menuTrigger.click();
    }
    return false;
  }

  menuItem.click();
  return true;
}

function getMenuItem(root: Document): HTMLButtonElement | null {
  return (
    root.querySelector<HTMLButtonElement>(MENU_ITEM_SELECTOR) ??
    Array.from(
      root.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'),
    ).find(
      (button) =>
        normalizeWhitespace(button.textContent) === "Update Timesheet",
    ) ??
    null
  );
}

function waitForMenuItem(
  root: Document,
  timeoutMs: number,
): Promise<HTMLButtonElement | null> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      const menuItem = getMenuItem(root);
      if (menuItem || Date.now() >= deadline) {
        resolve(menuItem);
        return;
      }
      root.defaultView?.setTimeout(check, 50);
    };
    check();
  });
}

function ensureStyles(root: Document) {
  if (root.getElementById(STYLES_ID)) return;

  const style = root.createElement("style");
  style.id = STYLES_ID;
  style.textContent = `
    .adv-update-timesheet-shortcut {
      flex: 0 0 auto;
      align-self: center;
      white-space: nowrap;
      margin: 0 12px 0 0;
    }

    .adv-update-timesheet-shortcut[aria-busy="true"] {
      opacity: 0.7;
      pointer-events: none;
    }
  `;
  root.head.appendChild(style);
}

function isDisabled(element: HTMLButtonElement): boolean {
  return element.disabled || element.getAttribute("aria-disabled") === "true";
}

function isVisible(element: HTMLElement): boolean {
  return element.getClientRects().length > 0;
}

function normalizeWhitespace(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}
