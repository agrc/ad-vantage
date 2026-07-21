import {
  getColumnPrefs,
  getLookupData,
  setColumnPrefs,
  type ColumnPrefs,
  type LookupDataRecord,
} from "../shared/storage";

interface ColumnInfo {
  key: string;
  label: string;
}

const DESCRIPTION_COL_KEY = "adv-description";
const DESCRIPTION_COL_LABEL = "Description";
const DAILY_ACTIVITY_QA = "DLY_ACTV_CD";
const GET_COLUMNS_MESSAGE_TYPE = "adv:get-columns";
const SERVICE_NOW_SYNC = "adv:servicenow-sync";

let prefs: ColumnPrefs = {
  hidden: [],
  frozen: [DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY],
};
let columns: ColumnInfo[] = [];
let lookupData: LookupDataRecord | null = null;

function renderHeaderIcon() {
  const iconElement = document.getElementById(
    "header-icon",
  ) as HTMLImageElement | null;
  if (!iconElement) return;

  iconElement.src = chrome.runtime.getURL("icons/icon48.png");
}

function renderExtensionVersion() {
  const versionElement = document.getElementById("extension-version");
  if (!versionElement) return;

  versionElement.textContent = `v${chrome.runtime.getManifest().version}`;
}

async function init() {
  renderHeaderIcon();
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

  renderLookupSummary();

  syncButton.addEventListener("click", async () => {
    const succeeded = await runServiceNowAction(
      syncButton,
      "Fetching...",
      SERVICE_NOW_SYNC,
    );
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

  document.getElementById("reset-btn")!.addEventListener("click", async () => {
    prefs = {
      hidden: [],
      frozen: [DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY],
    };
    await setColumnPrefs(prefs);
    renderColumnList(columnList);
  });
}

async function sendServiceNowMessage<T = { ok: boolean; error?: string }>(
  type: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type }, (response: T | undefined) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response as T);
    });
  });
}

async function runServiceNowAction(
  button: HTMLButtonElement,
  busyLabel: string,
  type: string,
): Promise<boolean> {
  button.disabled = true;
  const originalLabel = button.textContent ?? "Action";
  button.textContent = busyLabel;
  try {
    const response = await sendServiceNowMessage<{
      ok: boolean;
      error?: string;
    }>(type);
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
        if (input.checked) {
          prefs.hidden = prefs.hidden.filter((k) => k !== key);
        } else {
          if (!prefs.hidden.includes(key)) prefs.hidden.push(key);
        }
        await setColumnPrefs(prefs);
      });
    });

  container
    .querySelectorAll<HTMLInputElement>('input[data-type="freeze"]')
    .forEach((input) => {
      input.addEventListener("change", async () => {
        const key = input.dataset.key!;
        if (input.checked) {
          if (!prefs.frozen.includes(key)) prefs.frozen.push(key);
          if (
            key === DESCRIPTION_COL_KEY &&
            !prefs.frozen.includes(DAILY_ACTIVITY_QA)
          ) {
            prefs.frozen.unshift(DAILY_ACTIVITY_QA);
          }
        } else {
          prefs.frozen = prefs.frozen.filter((k) => k !== key);
          if (key === DAILY_ACTIVITY_QA) {
            prefs.frozen = prefs.frozen.filter(
              (k) => k !== DESCRIPTION_COL_KEY,
            );
          }
        }
        await setColumnPrefs(prefs);
        prefs = await getColumnPrefs();
        renderColumnList(container);
      });
    });
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
    createVisibilityControl({ key, checked: isVisible }),
    createFreezeControl({ key, checked: isFrozen }),
  );

  row.append(labelSpan, controls);
  return row;
}

function createVisibilityControl(options: {
  key: string;
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

  const track = document.createElement("span");
  track.className = "toggle-track";

  toggle.append(input, track);
  group.append(groupLabel, toggle);

  return group;
}

function createFreezeControl(options: {
  key: string;
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

  group.append(groupLabel, input);

  return group;
}

async function detectColumnsFromActiveTab(): Promise<ColumnInfo[]> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return [];

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: GET_COLUMNS_MESSAGE_TYPE,
    })) as { columns?: ColumnInfo[] } | undefined;

    return ensureDescriptionColumn(response?.columns ?? []);
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

init();
