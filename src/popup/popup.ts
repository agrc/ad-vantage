import {
  DAILY_ACTIVITY_QA,
  DESCRIPTION_COL_KEY,
  DESCRIPTION_COL_LABEL,
} from "../shared/constants";
import {
  GET_COLUMNS_MESSAGE_TYPE,
  isGetColumnsResponse,
  SERVICE_NOW_SYNC_MESSAGE_TYPE,
  type ColumnInfo,
  type ServiceNowSyncResponse,
} from "../shared/messages";
import {
  getColumnPrefs,
  getLookupData,
  resetExtensionData,
  setColumnPrefs,
  type ColumnPrefs,
  type LookupDataRecord,
} from "../shared/storage";
import {
  createColumnPrefsWriter,
  setColumnFrozen,
  setColumnVisibility,
} from "./column-prefs";

let prefs: ColumnPrefs = {
  hidden: [],
  frozen: [DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY],
};
let columns: ColumnInfo[] = [];
let lookupData: LookupDataRecord | null = null;
const preferenceWriter = createColumnPrefsWriter(setColumnPrefs);

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

  const [nextPrefs, nextColumns, nextLookupData] = await Promise.all([
    getColumnPrefs(),
    detectColumnsFromActiveTab(),
    getLookupData(),
  ]);

  prefs = nextPrefs;
  columns = nextColumns;
  lookupData = nextLookupData;

  const emptyState = document.getElementById("empty-state")!;
  const columnList = document.getElementById("column-list")!;
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

  resetButton.addEventListener("click", async () => {
    resetButton.disabled = true;
    try {
      await resetExtensionData();
      prefs = {
        hidden: [],
        frozen: [DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY],
      };
      lookupData = null;
      renderLookupSummary();
      renderColumnList(columnList);
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
    chrome.runtime.sendMessage(
      { type: SERVICE_NOW_SYNC_MESSAGE_TYPE },
      (response: ServiceNowSyncResponse | undefined) => {
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
    const isVisible = !prefs.hidden.includes(key);
    const isFrozen = prefs.frozen.includes(key);
    container.appendChild(createColumnRow({ key, label, isVisible, isFrozen }));
  });

  container
    .querySelectorAll<HTMLInputElement>('input[data-type="visible"]')
    .forEach((input) => {
      input.addEventListener("change", async () => {
        const key = input.dataset.key!;
        await persistColumnPrefs(
          setColumnVisibility(prefs, key, input.checked),
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
          setColumnFrozen(prefs, key, input.checked),
          container,
        );
      });
    });
}

async function persistColumnPrefs(
  nextPrefs: ColumnPrefs,
  container: HTMLElement,
): Promise<void> {
  prefs = nextPrefs;

  try {
    await preferenceWriter.write(nextPrefs);
    prefs = await getColumnPrefs();
  } catch (error) {
    prefs = await getColumnPrefs().catch(() => nextPrefs);
    renderLookupError(
      error instanceof Error ? error.message : "Column settings update failed.",
    );
  }

  renderColumnList(container);
}

function createColumnRow(options: {
  key: string;
  label: string;
  isVisible: boolean;
  isFrozen: boolean;
}): HTMLDivElement {
  const { key, label, isVisible, isFrozen } = options;

  const row = document.createElement("div");
  row.className = "column-row";

  const labelSpan = document.createElement("span");
  labelSpan.className = "column-label";
  labelSpan.title = label;
  labelSpan.textContent = label;

  const controls = document.createElement("div");
  controls.className = "column-controls";

  controls.append(
    createVisibilityControl({ key, label, checked: isVisible }),
    createFreezeControl({ key, label, checked: isFrozen }),
  );

  row.append(labelSpan, controls);
  return row;
}

function createVisibilityControl(options: {
  key: string;
  label: string;
  checked: boolean;
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
  input.dataset.type = "visible";
  input.checked = options.checked;
  input.setAttribute("aria-label", `Show ${options.label} column`);

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
