import {
  DAILY_ACTIVITY_QA,
  DESCRIPTION_COL_KEY,
  DESCRIPTION_COL_LABEL,
} from "../shared/constants";
import {
  GET_COLUMNS_MESSAGE_TYPE,
  GET_ROWS_MESSAGE_TYPE,
  isGetColumnsResponse,
  isGetRowsResponse,
  SERVICE_NOW_SYNC_MESSAGE_TYPE,
  type ColumnInfo,
  type RowInfo,
  type ServiceNowSyncResponse,
} from "../shared/messages";
import {
  getPreferences,
  updateColumnPrefs,
  updateRowPrefs,
  type ColumnPrefs,
  type Preferences,
  type RowPrefs,
} from "../shared/preferences";
import {
  getLookupData,
  resetExtensionData,
  type LookupDataRecord,
} from "../shared/storage";
import {
  createColumnPrefsWriter,
  setColumnFrozen,
  setColumnVisibility,
} from "./column-prefs";
import {
  createPrefsWriter,
  setVisibility,
} from "./visibility-prefs";

let prefs: Preferences = {
  columns: {
    hidden: [],
    frozen: [DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY],
  },
  rows: {
    hidden: [],
  },
};
let columns: ColumnInfo[] = [];
let rows: RowInfo[] = [];
let lookupData: LookupDataRecord | null = null;
const columnPreferenceWriter = createColumnPrefsWriter(updateColumnPrefs);
const rowPreferenceWriter = createPrefsWriter(updateRowPrefs);
const SERVICE_NOW_RESPONSE_TIMEOUT_MS = 60_000;

function renderHeaderIcon() {
  const iconElement = document.getElementById(
    "header-icon",
  ) as HTMLImageElement | null;
  const iconPath = chrome.runtime.getManifest().icons?.["48"];
  if (!iconElement || !iconPath) return;

  iconElement.src = chrome.runtime.getURL(iconPath);
  const isPreRelease = iconPath.startsWith("icons/pre-release/");
  document.body.dataset.theme = isPreRelease ? "pre-release" : "production";
  renderChangelogLink(isPreRelease);
}

function renderChangelogLink(isPreRelease: boolean) {
  const versionElement = document.getElementById(
    "extension-version",
  ) as HTMLAnchorElement | null;
  if (!versionElement) return;

  const branch = isPreRelease ? "dev" : "main";
  versionElement.href = `https://github.com/agrc/ad-vantage/blob/${branch}/CHANGELOG.md`;
}

function renderExtensionName() {
  const extensionName = chrome.runtime.getManifest().name;
  const nameElement = document.getElementById("extension-name");
  if (nameElement) {
    nameElement.textContent = extensionName;
  }

  document.title = extensionName;
}

function renderExtensionVersion() {
  const versionElement = document.getElementById(
    "extension-version",
  ) as HTMLAnchorElement | null;
  if (!versionElement) return;

  versionElement.textContent = `v${chrome.runtime.getManifest().version}`;
}

async function init() {
  renderHeaderIcon();
  renderExtensionName();
  renderExtensionVersion();

  const [nextPrefs, nextColumns, nextRows, nextLookupData] = await Promise.all([
    getPreferences(),
    detectColumnsFromActiveTab(),
    detectRowsFromActiveTab(),
    getLookupData(),
  ]);

  prefs = nextPrefs;
  columns = nextColumns;
  rows = nextRows;
  lookupData = nextLookupData;

  const emptyState = document.getElementById("empty-state")!;
  const columnList = document.getElementById("column-list")!;
  const rowEmptyState = document.getElementById("row-empty-state")!;
  const rowList = document.getElementById("row-list")!;
  const syncButton = document.getElementById("sync-btn") as HTMLButtonElement;
  const resetButton = document.getElementById("reset-btn") as HTMLButtonElement;

  renderLookupSummary();

  syncButton.addEventListener("click", async () => {
    const succeeded = await runServiceNowAction(syncButton, "Fetching...");
    if (succeeded) {
      lookupData = await getLookupData();
      renderLookupSummary();
    }
  });

  if (columns.length === 0) {
    emptyState.hidden = false;
    columnList.hidden = true;
  } else {
    emptyState.hidden = true;
    columnList.hidden = false;
    renderColumnList(columnList);
  }

  const hasScheduledHours = rows.some((row) => {
    return row.label === "Scheduled Hours";
  });
  if (!hasScheduledHours) {
    rowEmptyState.hidden = false;
    rowList.hidden = true;
  } else {
    rowEmptyState.hidden = true;
    rowList.hidden = false;
    renderRowList(rowList);
  }

  resetButton.addEventListener("click", async () => {
    resetButton.disabled = true;
    try {
      await resetExtensionData();
      prefs = {
        columns: {
          hidden: [],
          frozen: [DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY],
        },
        rows: {
          hidden: [],
        },
      };
      lookupData = null;
      renderLookupSummary();
      renderColumnList(columnList);
      renderRowList(rowList);
    } catch (error) {
      renderLookupError(
        error instanceof Error ? error.message : "Settings reset failed.",
      );
    } finally {
      resetButton.disabled = false;
    }
  });
}

async function sendServiceNowMessage(): Promise<ServiceNowSyncResponse> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(
        new Error(
          "The ServiceNow background process did not respond. Try again.",
        ),
      );
    }, SERVICE_NOW_RESPONSE_TIMEOUT_MS);

    chrome.runtime.sendMessage(
      { type: SERVICE_NOW_SYNC_MESSAGE_TYPE },
      (response: ServiceNowSyncResponse | undefined) => {
        clearTimeout(timeoutId);
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        if (!response) {
          reject(new Error("ServiceNow did not return a response."));
          return;
        }
        resolve(response);
      },
    );
  });
}

async function runServiceNowAction(
  button: HTMLButtonElement,
  busyLabel: string,
): Promise<boolean> {
  button.disabled = true;
  const originalLabel = button.textContent ?? "Action";
  button.textContent = busyLabel;
  try {
    const response = await sendServiceNowMessage();
    if (!response?.ok) throw new Error(response?.error ?? "Request failed.");
    return true;
  } catch (error) {
    renderLookupError(
      error instanceof Error ? error.message : "ServiceNow request failed.",
    );
    return false;
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function renderLookupSummary() {
  const summary = document.getElementById("lookup-summary")!;
  summary.removeAttribute("data-state");

  if (!lookupData) {
    summary.textContent =
      "No ServiceNow tasks synced. The Description column and Daily Activity autocomplete will stay blank.";
    return;
  }

  const uploadedAt = new Date(lookupData.uploadedAt).toLocaleString();
  const count = document.createElement("span");
  count.textContent = `Total tasks loaded: ${lookupData.entryCount.toLocaleString()}`;
  const updated = document.createElement("span");
  updated.textContent = `Updated: ${uploadedAt}`;
  summary.replaceChildren(count, updated);
}

function renderLookupError(message: string) {
  const summary = document.getElementById("lookup-summary")!;
  summary.textContent = message;
  summary.setAttribute("data-state", "error");
}

function renderColumnList(container: HTMLElement) {
  container.replaceChildren();
  columns.forEach(({ key, label }) => {
    const isVisible = !prefs.columns.hidden.includes(key);
    const isFrozen = prefs.columns.frozen.includes(key);

    container.appendChild(createColumnRow({ key, label, isVisible, isFrozen }));
  });

  container
    .querySelectorAll<HTMLInputElement>('input[data-type="visible"]')
    .forEach((input) => {
      input.addEventListener("change", async () => {
        const key = input.dataset.key!;

        await persistColumnPrefs(
          setColumnVisibility(prefs.columns, key, input.checked),
          container,
        );
      });
    });

  container
    .querySelectorAll<HTMLInputElement>('input[data-type="freeze"]')
    .forEach((input) => {
      input.addEventListener("change", async () => {
        const key = input.dataset.key!;

        await persistColumnPrefs(
          setColumnFrozen(prefs.columns, key, input.checked),
          container,
        );
      });
    });
}

async function persistPreferencesDomain<T>(options: {
  nextPrefs: T;
  writer: { write: (prefs: T) => Promise<void> };
  setLocal: (prefs: T) => void;
  getLocal: (prefs: Preferences) => T;
  errorMessage: string;
  render: () => void;
}): Promise<void> {
  options.setLocal(options.nextPrefs);

  try {
    await options.writer.write(options.nextPrefs);
    const updated = await getPreferences();

    options.setLocal(options.getLocal(updated));
  } catch (error) {
    const updated = await getPreferences().catch(() => {
      return prefs;
    });

    options.setLocal(options.getLocal(updated));
    renderLookupError(
      error instanceof Error ? error.message : options.errorMessage,
    );
  }

  options.render();
}

async function persistColumnPrefs(
  nextPrefs: ColumnPrefs,
  container: HTMLElement,
): Promise<void> {
  return persistPreferencesDomain({
    nextPrefs,
    writer: columnPreferenceWriter,
    setLocal: (p) => {
      prefs.columns = p;
    },
    getLocal: (p) => {
      return p.columns;
    },
    errorMessage: "Column settings update failed.",
    render: () => {
      renderColumnList(container);
    },
  });
}

function renderRowList(container: HTMLElement) {
  container.replaceChildren();
  const scheduledRow = rows.find((r) => {
    return r.label === "Scheduled Hours";
  });

  if (!scheduledRow) {
    return;
  }

  const isVisible = !prefs.rows.hidden.includes(scheduledRow.label);

  container.appendChild(
    createRowItem({
      label: scheduledRow.label,
      isVisible,
    }),
  );

  container
    .querySelectorAll<HTMLInputElement>('input[data-type="row-visible"]')
    .forEach((input) => {
      input.addEventListener("change", async () => {
        const label = input.dataset.label!;

        await persistRowPrefs(
          setVisibility(prefs.rows, label, input.checked),
          container,
        );
      });
    });
}

async function persistRowPrefs(
  nextPrefs: RowPrefs,
  container: HTMLElement,
): Promise<void> {
  return persistPreferencesDomain({
    nextPrefs,
    writer: rowPreferenceWriter,
    setLocal: (p) => {
      prefs.rows = p;
    },
    getLocal: (p) => {
      return p.rows;
    },
    errorMessage: "Row settings update failed.",
    render: () => {
      renderRowList(container);
    },
  });
}

function createPreferenceRow(options: {
  className: string;
  labelClassName: string;
  label: string;
  controlsClassName: string;
  controls: HTMLElement[];
}): HTMLDivElement {
  const row = document.createElement("div");
  row.className = options.className;

  const labelSpan = document.createElement("span");
  labelSpan.className = options.labelClassName;
  labelSpan.title = options.label;
  labelSpan.textContent = options.label;

  const controls = document.createElement("div");
  controls.className = options.controlsClassName;
  controls.append(...options.controls);

  row.append(labelSpan, controls);

  return row;
}

function createRowItem(options: {
  label: string;
  isVisible: boolean;
}): HTMLDivElement {
  const { label, isVisible } = options;

  return createPreferenceRow({
    className: "row-item",
    labelClassName: "row-label",
    label,
    controlsClassName: "row-controls",
    controls: [
      createVisibilityControl({
        key: label,
        label,
        checked: isVisible,
        type: "row-visible",
        labelAttr: label,
        ariaLabel: `Show ${label} row`,
      }),
    ],
  });
}

function createColumnRow(options: {
  key: string;
  label: string;
  isVisible: boolean;
  isFrozen: boolean;
}): HTMLDivElement {
  const { key, label, isVisible, isFrozen } = options;

  return createPreferenceRow({
    className: "column-row",
    labelClassName: "column-label",
    label,
    controlsClassName: "column-controls",
    controls: [
      createVisibilityControl({
        key,
        label,
        checked: isVisible,
        type: "visible",
      }),
      createFreezeControl({ key, label, checked: isFrozen }),
    ],
  });
}

function createVisibilityControl(options: {
  key: string;
  label: string;
  checked: boolean;
  type?: string;
  labelAttr?: string;
  ariaLabel?: string;
}): HTMLDivElement {
  const group = document.createElement("div");
  group.className = "control-group";

  const groupLabel = document.createElement("label");
  groupLabel.textContent = "Visible";

  const toggle = document.createElement("label");
  toggle.className = "toggle";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.key = options.key;
  if (options.labelAttr) {
    input.dataset.label = options.labelAttr;
  }
  input.dataset.type = options.type ?? "visible";
  input.checked = options.checked;
  input.setAttribute(
    "aria-label",
    options.ariaLabel ?? `Show ${options.label} column`,
  );

  const track = document.createElement("span");
  track.className = "toggle-track";

  toggle.append(input, track);
  group.append(groupLabel, toggle);

  return group;
}

function createFreezeControl(options: {
  key: string;
  label: string;
  checked: boolean;
}): HTMLDivElement {
  const group = document.createElement("div");
  group.className = "control-group";

  const groupLabel = document.createElement("label");
  groupLabel.textContent = "Freeze";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "freeze-check";
  input.dataset.key = options.key;
  input.dataset.type = "freeze";
  input.checked = options.checked;
  input.setAttribute("aria-label", `Freeze ${options.label} column`);

  group.append(groupLabel, input);

  return group;
}

async function detectRowsFromActiveTab(): Promise<RowInfo[]> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return [];
  }

  try {
    const response: unknown = await chrome.tabs.sendMessage(tab.id, {
      type: GET_ROWS_MESSAGE_TYPE,
    });

    return isGetRowsResponse(response) ? response.rows : [];
  } catch {
    return [];
  }
}

async function detectColumnsFromActiveTab(): Promise<ColumnInfo[]> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return [];

  try {
    const response: unknown = await chrome.tabs.sendMessage(tab.id, {
      type: GET_COLUMNS_MESSAGE_TYPE,
    });

    return ensureDescriptionColumn(
      isGetColumnsResponse(response) ? response.columns : [],
    );
  } catch {
    return ensureDescriptionColumn([]);
  }
}

function ensureDescriptionColumn(columns: ColumnInfo[]): ColumnInfo[] {
  const withoutDescription = columns.filter(
    ({ key }) => key !== DESCRIPTION_COL_KEY,
  );
  const insertAt = withoutDescription.findIndex(
    ({ key }) => key === DAILY_ACTIVITY_QA,
  );
  const descriptionColumn = {
    key: DESCRIPTION_COL_KEY,
    label: DESCRIPTION_COL_LABEL,
  };

  if (insertAt === -1) {
    return [...withoutDescription, descriptionColumn];
  }

  return [
    ...withoutDescription.slice(0, insertAt + 1),
    descriptionColumn,
    ...withoutDescription.slice(insertAt + 1),
  ];
}

void init().catch((error: unknown) => {
  renderLookupError(
    error instanceof Error ? error.message : "Popup initialization failed.",
  );
});
