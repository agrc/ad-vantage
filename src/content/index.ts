import { DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY } from "../shared/constants";
import {
  isGetColumnsRequest,
  isGetRowsRequest,
  type ColumnInfo,
  type RowInfo,
} from "../shared/messages";
import {
  getPreferences,
  onPreferencesChanged,
  type Preferences,
} from "../shared/preferences";
import { onLookupDataChanged } from "../shared/storage";
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
  applyRowVisibility,
  clearFrozenColumns,
  CONFIGURABLE_SUMMARY_LABELS,
  getSummaryRowLabels,
  prepareGridForFrozenColumns,
} from "./column-layout";
import { getColumnLayout } from "./grid-alignment";
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
import { createLayoutRefreshController } from "./layout-refresh";
import { createDailyActivityRowFocusController } from "./new-row-focus";
import { createUpdateTimesheetShortcutController } from "./page-actions";
import { applyTimeWarnings, ensureTimeWarningStyles } from "./time-warnings";

let lookupMap: Map<string, string> = new Map();
let lookupEntries: AutocompleteLookupEntry[] = [];
let currentPrefs: Preferences = {
  columns: {
    hidden: [],
    frozen: [DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY],
  },
  rows: {
    hidden: [],
  },
};
let hasLoggedMissingGrid = false;
const warnedMissingTasks = new Set<string>();
const paginationAutomation = createPaginationAutomationController();
const dailyActivityRowFocus = createDailyActivityRowFocusController();
const updateTimesheetShortcut = createUpdateTimesheetShortcutController();
const autocomplete = createAutocompleteController(document, applyEnhancements);
const layoutRefresh = createLayoutRefreshController(applyEnhancements);

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
    currentPrefs = await getPreferences();
  } catch (error) {
    console.warn(
      "[ad-vantage] Failed to load preferences; using defaults.",
      error,
    );
    currentPrefs = {
      columns: {
        hidden: [],
        frozen: [DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY],
      },
      rows: {
        hidden: [],
      },
    };
  }

  console.info("[ad-vantage] Initial state ready.", {
    lookupEntries: lookupMap.size,
    autocompleteEntries: lookupEntries.length,
    hiddenColumns: currentPrefs.columns.hidden,
    frozenColumns: currentPrefs.columns.frozen,
    hiddenRows: currentPrefs.rows.hidden,
  });

  applyEnhancements();

  onPreferencesChanged((prefs) => {
    currentPrefs = prefs;
    console.info("[ad-vantage] Preferences changed.", prefs);
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
    if (isGetColumnsRequest(message)) {
      sendResponse({ columns: getColumnsForPopup() });

      return;
    }

    if (isGetRowsRequest(message)) {
      sendResponse({ rows: getRowsForPopup() });

      return;
    }
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
    dailyActivityRowFocus.sync();
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
  }
  clearFrozenColumns(grid);
  if (stickyHeaderRow) {
    clearFrozenColumns(stickyHeaderRow.closest("table")!);
  }
  applyColumnVisibility(grid, mainHeaderRow, currentPrefs.columns.hidden);
  applyRowVisibility(grid, currentPrefs.rows.hidden);
  const columnLayout = getColumnLayout(mainHeaderRow);
  if (mainHeaderRow.querySelector(`th[data-qa="${DAILY_ACTIVITY_QA}"]`)) {
    syncStickyHeaderColumnWidths(columnLayout, stickyHeaderRow);
  }
  if (stickyHeaderRow) {
    applyColumnVisibility(
      stickyHeaderRow.closest("table")!,
      stickyHeaderRow,
      currentPrefs.columns.hidden,
    );
  }
  applyFrozenColumns(
    grid,
    mainHeaderRow,
    currentPrefs.columns.frozen,
    columnLayout,
  );
  if (stickyHeaderRow) {
    applyFrozenColumns(
      stickyHeaderRow.closest("table")!,
      stickyHeaderRow,
      currentPrefs.columns.frozen,
      columnLayout,
    );
  }
  layoutRefresh.sync([mainHeaderRow, ...getColumnHeaders(mainHeaderRow)]);
  autocomplete.bind(grid, mainHeaderRow, lookupEntries);
  applyTimeWarnings(grid, mainHeaderRow);
}

function getRowsForPopup(): RowInfo[] {
  const grids = getEnhanceableGrids();
  const seen = new Set<string>();
  const rows: RowInfo[] = [];

  for (const grid of grids) {
    for (const label of getSummaryRowLabels(grid)) {
      if (CONFIGURABLE_SUMMARY_LABELS.has(label) && !seen.has(label)) {
        seen.add(label);
        rows.push({ label });
      }
    }
  }

  return rows;
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
