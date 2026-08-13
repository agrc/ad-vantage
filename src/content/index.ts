import { DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY } from "../shared/constants";
import { isGetColumnsRequest, type ColumnInfo } from "../shared/messages";
import {
  getColumnPrefs,
  onColumnPrefsChanged,
  onLookupDataChanged,
  type ColumnPrefs,
} from "../shared/storage";
import { loadLookupEntries, loadLookupMap } from "../shared/lookup";
import {
  buildAutocompleteEntries,
  type AutocompleteLookupEntry,
} from "./autocomplete";
import { createAutocompleteController } from "./autocomplete-dom";
import { createPaginationAutomationController } from "./pagination";
import {
  applyColumnVisibility,
  applyFrozenColumns,
  prepareGridForFrozenColumns,
} from "./column-layout";
import {
  clearLegacyBodyColumnWidths,
  syncDescriptionColumns,
  syncDescriptionHeaderCell,
  syncStickyHeaderColumnWidths,
} from "./description-column";
import {
  getColumnHeaders,
  getColumnKey,
  getEnhanceableGrids,
  getHeaderRows,
  getMainHeaderRow,
  getStickyHeaderRow,
  isDailyActivityGrid,
  isEnhanceableGrid,
} from "./grid-dom";
import { createUpdateTimesheetShortcutController } from "./page-actions";
import { applyTimeWarnings, ensureTimeWarningStyles } from "./time-warnings";

let lookupMap: Map<string, string> = new Map();
let lookupEntries: AutocompleteLookupEntry[] = [];
let currentPrefs: ColumnPrefs = {
  hidden: [],
  frozen: [DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY],
};
let hasLoggedMissingGrid = false;
const warnedMissingTasks = new Set<string>();
const paginationAutomation = createPaginationAutomationController();
const updateTimesheetShortcut = createUpdateTimesheetShortcutController();
const autocomplete = createAutocompleteController(document, applyEnhancements);

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function init() {
  console.info("[ad-vantage] Content script initializing.");

  const [initialLookupMap, initialLookupEntries] = await Promise.all([
    loadLookupMap(),
    loadLookupEntries(),
  ]);

  lookupMap = initialLookupMap;
  lookupEntries = buildAutocompleteEntries(initialLookupEntries);

  try {
    currentPrefs = await getColumnPrefs();
  } catch (error) {
    console.warn(
      "[ad-vantage] Failed to load column preferences; using defaults.",
      error,
    );
    currentPrefs = {
      hidden: [],
      frozen: [DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY],
    };
  }

  console.info("[ad-vantage] Initial state ready.", {
    lookupEntries: lookupMap.size,
    autocompleteEntries: lookupEntries.length,
    hidden: currentPrefs.hidden,
    frozen: currentPrefs.frozen,
  });

  applyEnhancements();

  onColumnPrefsChanged((prefs) => {
    currentPrefs = prefs;
    console.info("[ad-vantage] Column preferences changed.", prefs);
    applyEnhancements();
  });

  onLookupDataChanged(async () => {
    try {
      const [nextLookupMap, nextLookupEntries] = await Promise.all([
        loadLookupMap(),
        loadLookupEntries(),
      ]);

      lookupMap = nextLookupMap;
      lookupEntries = buildAutocompleteEntries(nextLookupEntries);
      warnedMissingTasks.clear();
      console.info("[ad-vantage] Lookup data changed.", {
        lookupEntries: lookupMap.size,
        autocompleteEntries: lookupEntries.length,
      });
      applyEnhancements();
    } catch (error) {
      console.warn("[ad-vantage] Failed to refresh lookup data.", error);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isGetColumnsRequest(message)) {
      return;
    }

    sendResponse({ columns: getColumnsForPopup() });
  });

  observeMutations();
}

// ─── Main enhancement entry point ────────────────────────────────────────────

function applyEnhancements() {
  mutationObserver?.disconnect();
  try {
    autocomplete.ensureStyles();
    ensureTimeWarningStyles();
    updateTimesheetShortcut.sync();
    autocomplete.closeIfStale();

    const grids = getEnhanceableGrids();

    if (grids.length === 0) {
      if (!hasLoggedMissingGrid) {
        console.info(
          "[ad-vantage] No grids found yet; waiting for page render.",
        );
        hasLoggedMissingGrid = true;
      }
      return;
    }

    hasLoggedMissingGrid = false;
    grids.forEach(enhanceGrid);
    grids
      .filter(isDailyActivityGrid)
      .forEach((grid) => paginationAutomation.sync(grid));
  } finally {
    mutationObserver?.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
}

function enhanceGrid(grid: HTMLElement) {
  if (!isEnhanceableGrid(grid)) return;

  const headerRows = getHeaderRows(grid);
  const mainHeaderRow = getMainHeaderRow(grid);
  const stickyHeaderRow = getStickyHeaderRow(grid);

  if (!mainHeaderRow) return;

  prepareGridForFrozenColumns(grid);
  syncDescriptionColumns(
    grid,
    headerRows,
    mainHeaderRow,
    lookupMap,
    warnMissingTask,
  );
  if (stickyHeaderRow) {
    syncDescriptionHeaderCell(stickyHeaderRow);
  }
  if (mainHeaderRow.querySelector(`th[data-qa="${DAILY_ACTIVITY_QA}"]`)) {
    clearLegacyBodyColumnWidths(grid, mainHeaderRow);
    syncStickyHeaderColumnWidths(mainHeaderRow, stickyHeaderRow);
  }
  applyColumnVisibility(grid, mainHeaderRow, currentPrefs.hidden);
  if (stickyHeaderRow) {
    applyColumnVisibility(
      stickyHeaderRow.closest("table")!,
      stickyHeaderRow,
      currentPrefs.hidden,
    );
  }
  applyFrozenColumns(grid, mainHeaderRow, currentPrefs.frozen);
  if (stickyHeaderRow) {
    applyFrozenColumns(
      stickyHeaderRow.closest("table")!,
      stickyHeaderRow,
      currentPrefs.frozen,
    );
  }
  autocomplete.bind(grid, mainHeaderRow, lookupEntries);
  applyTimeWarnings(grid, mainHeaderRow);
}

function getColumnsForPopup(): ColumnInfo[] {
  const mainHeaderRow = getEnhanceableGrids()
    .map((grid) => getMainHeaderRow(grid))
    .find((headerRow): headerRow is HTMLElement => Boolean(headerRow));

  if (!mainHeaderRow) {
    return [];
  }

  const seen = new Set<string>();

  return getColumnHeaders(mainHeaderRow).reduce<ColumnInfo[]>((acc, th) => {
    const key = getColumnKey(th);
    if (!key || seen.has(key)) {
      return acc;
    }

    seen.add(key);
    acc.push({
      key,
      label: getColumnLabel(th),
    });

    return acc;
  }, []);
}

function getColumnLabel(th: HTMLElement): string {
  const label =
    th.querySelector('[data-qa-id$=".headerCellTitle"]')?.textContent?.trim() ??
    th.textContent?.trim() ??
    "";

  const dateMatch = label.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/i);
  return dateMatch ? dateMatch[1] : label;
}

function warnMissingTask(taskCode: string) {
  if (warnedMissingTasks.has(taskCode)) return;

  warnedMissingTasks.add(taskCode);
  console.warn(
    `[ad-vantage] No description match found in uploaded lookup data for task "${taskCode}".`,
  );
}

// ─── MutationObserver ────────────────────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let mutationObserver: MutationObserver | null = null;

function observeMutations() {
  mutationObserver = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      applyEnhancements();
      window.requestAnimationFrame(() => {
        applyEnhancements();
      });
    }, 300);
  });

  mutationObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["aria-label"],
    childList: true,
    subtree: true,
  });

  window.addEventListener("resize", updateTimesheetShortcut.schedule);
  window.addEventListener("scroll", updateTimesheetShortcut.schedule, true);
}

// ─── Start ───────────────────────────────────────────────────────────────────

init().catch((error) => {
  console.error("[ad-vantage] Content script failed to initialize.", error);
});
