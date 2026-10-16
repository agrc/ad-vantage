import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY } from "../shared/constants";
import type { ColumnPrefs, LookupDataRecord, RowPrefs } from "../shared/storage";

const storage = vi.hoisted(() => {
  return {
    prefs: { hidden: [] as string[], frozen: [] as string[] },
    rowPrefs: { hidden: [] as string[] },
    lookup: null as LookupDataRecord | null,
    getColumnPrefs: vi.fn(),
    getRowPrefs: vi.fn(),
    getLookupData: vi.fn(),
    setColumnPrefs: vi.fn(),
    setRowPrefs: vi.fn(),
    resetExtensionData: vi.fn(),
  };
});

vi.mock("../shared/storage", async (importOriginal) => {
  const original = await importOriginal<typeof import("../shared/storage")>();

  return {
    ...original,
    getColumnPrefs: storage.getColumnPrefs,
    getRowPrefs: storage.getRowPrefs,
    getLookupData: storage.getLookupData,
    setColumnPrefs: storage.setColumnPrefs,
    setRowPrefs: storage.setRowPrefs,
    resetExtensionData: storage.resetExtensionData,
  };
});

function renderPopupFixture() {
  document.body.innerHTML = `
    <img id="header-icon">
    <h1 id="extension-name"></h1>
    <a id="extension-version"></a>
    <button id="sync-btn">Fetch from ServiceNow</button>
    <div id="lookup-summary"></div>
    <p id="empty-state"></p>
    <div id="column-list" hidden></div>
    <p id="row-empty-state"></p>
    <div id="row-list" hidden></div>
    <button id="reset-btn">Reset All Settings</button>
  `;
}

function clonePrefs(): ColumnPrefs {
  return {
    hidden: [...storage.prefs.hidden],
    frozen: [...storage.prefs.frozen],
  };
}

function cloneRowPrefs(): RowPrefs {
  return {
    hidden: [...storage.rowPrefs.hidden],
  };
}

async function loadPopup(extensionName = "ad-vantage (Pre-release)") {
  await import("./popup");
  await vi.waitFor(() => {
    expect(document.getElementById("extension-version")?.textContent).toBe(
      "v1.2.3",
    );
    expect(document.getElementById("extension-name")?.textContent).toBe(
      extensionName,
    );
  });
}

beforeEach(() => {
  vi.resetModules();
  renderPopupFixture();
  storage.prefs = { hidden: [], frozen: [DAILY_ACTIVITY_QA] };
  storage.rowPrefs = { hidden: [] };
  storage.lookup = {
    entries: [["PRJ-1", "Monitor"]],
    entryCount: 1,
    uploadedAt: "2026-01-01T00:00:00.000Z",
  };
  storage.getColumnPrefs
    .mockReset()
    .mockImplementation(async () => {
      return clonePrefs();
    });
  storage.getRowPrefs
    .mockReset()
    .mockImplementation(async () => {
      return cloneRowPrefs();
    });
  storage.getLookupData
    .mockReset()
    .mockImplementation(async () => {
      return storage.lookup;
    });
  storage.setColumnPrefs
    .mockReset()
    .mockImplementation(async (prefs: ColumnPrefs) => {
      storage.prefs = { hidden: [...prefs.hidden], frozen: [...prefs.frozen] };
    });
  storage.setRowPrefs
    .mockReset()
    .mockImplementation(async (prefs: RowPrefs) => {
      storage.rowPrefs = { hidden: [...prefs.hidden] };
    });
  storage.resetExtensionData.mockReset().mockImplementation(async () => {
    storage.lookup = null;
    storage.rowPrefs = { hidden: [] };
  });

  vi.stubGlobal("chrome", {
    runtime: {
      getURL: vi.fn((path: string) => {
        return `chrome-extension://test/${path}`;
      }),
      getManifest: vi.fn(() => {
        return {
          name: "ad-vantage (Pre-release)",
          version: "1.2.3",
          icons: { "48": "icons/pre-release/icon48.png" },
        };
      }),
      sendMessage: vi.fn((_message, callback) => {
        return callback({ ok: true });
      }),
      lastError: undefined,
    },
    tabs: {
      query: vi.fn(async () => {
        return [{ id: 7 }];
      }),
      sendMessage: vi.fn(async (_tabId, message: { type: string }) => {
        if (message.type === "adv:get-columns") {
          return {
            columns: [
              { key: DAILY_ACTIVITY_QA, label: "Daily Activity" },
              { key: "Mon", label: "Mon" },
            ],
          };
        }

        if (message.type === "adv:get-rows") {
          return {
            rows: [
              { label: "Scheduled Hours" },
            ],
          };
        }

        return {};
      }),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("popup integration", () => {
  it("renders extension metadata, lookup status, and detected columns", async () => {
    await loadPopup();

    expect(
      (document.getElementById("header-icon") as HTMLImageElement).src,
    ).toBe("chrome-extension://test/icons/pre-release/icon48.png");
    expect(document.body.dataset.theme).toBe("pre-release");
    expect(document.title).toBe("ad-vantage (Pre-release)");
    expect(
      document.getElementById("extension-version")?.getAttribute("href"),
    ).toBe("https://github.com/agrc/ad-vantage/blob/dev/CHANGELOG.md");
    expect(document.getElementById("lookup-summary")?.textContent).toContain(
      "Total tasks loaded: 1",
    );
    expect(
      Array.from(document.querySelectorAll(".column-label")).map(
        (element) => element.textContent,
      ),
    ).toEqual(["Daily Activity", "Description", "Mon"]);
  });

  it("shows the column empty state when the active tab cannot be messaged", async () => {
    const tabs = chrome.tabs as typeof chrome.tabs & {
      sendMessage: ReturnType<typeof vi.fn>;
    };
    tabs.sendMessage.mockRejectedValue(new Error("Could not connect to tab"));

    await loadPopup();

    expect(document.getElementById("empty-state")?.hidden).toBe(false);
    expect(document.getElementById("column-list")?.hidden).toBe(true);
    expect(document.querySelectorAll(".column-label")).toHaveLength(0);
  });

  it("does not add Description to grids without a Daily Activity column", async () => {
    const tabs = chrome.tabs as typeof chrome.tabs & {
      sendMessage: ReturnType<typeof vi.fn>;
    };
    tabs.sendMessage.mockResolvedValue({
      columns: [
        { key: "START_DATE", label: "Pay Period Start Date" },
        { key: "END_DATE", label: "Pay Period End Date" },
        { key: "STATUS", label: "Status" },
      ],
    });

    await loadPopup();

    expect(
      Array.from(document.querySelectorAll(".column-label")).map(
        (element) => element.textContent,
      ),
    ).toEqual(["Pay Period Start Date", "Pay Period End Date", "Status"]);
    expect(
      document.querySelector(
        `input[data-key="${DESCRIPTION_COL_KEY}"]`,
      ),
    ).toBeNull();
  });

  it("links production builds to the main changelog", async () => {
    const runtime = chrome.runtime as typeof chrome.runtime & {
      getManifest: ReturnType<typeof vi.fn>;
    };
    runtime.getManifest.mockReturnValue({
      name: "ad-vantage",
      version: "1.2.3",
      icons: { "48": "icons/icon48.png" },
    });

    await loadPopup("ad-vantage");

    expect(document.body.dataset.theme).toBe("production");
    expect(
      document.getElementById("extension-version")?.getAttribute("href"),
    ).toBe("https://github.com/agrc/ad-vantage/blob/main/CHANGELOG.md");
  });

  it("persists visibility changes and rerenders from stored preferences", async () => {
    await loadPopup();
    const visibleToggle = document.querySelector<HTMLInputElement>(
      `input[data-type="visible"][data-key="${DAILY_ACTIVITY_QA}"]`,
    )!;

    visibleToggle.checked = false;
    visibleToggle.dispatchEvent(new Event("change"));

    await vi.waitFor(() =>
      expect(storage.setColumnPrefs).toHaveBeenCalledOnce(),
    );
    expect(storage.prefs.hidden).toEqual([DAILY_ACTIVITY_QA]);
    expect(
      document.querySelector<HTMLInputElement>(
        `input[data-type="visible"][data-key="${DAILY_ACTIVITY_QA}"]`,
      )?.checked,
    ).toBe(false);
  });

  it("refreshes lookup status after sync and clears it after reset", async () => {
    storage.lookup = null;
    const runtime = chrome.runtime as typeof chrome.runtime & {
      sendMessage: ReturnType<typeof vi.fn>;
    };
    runtime.sendMessage.mockImplementation((_message, callback) => {
      storage.lookup = {
        entries: [["PRJ-2", "Network"]],
        entryCount: 1,
        uploadedAt: "2026-02-01T00:00:00.000Z",
      };
      callback({ ok: true });
    });
    await loadPopup();

    document.getElementById("sync-btn")?.click();
    await vi.waitFor(() => {
      expect(document.getElementById("lookup-summary")?.textContent).toContain(
        "Total tasks loaded: 1",
      );
    });

    document.getElementById("reset-btn")?.click();
    await vi.waitFor(() =>
      expect(storage.resetExtensionData).toHaveBeenCalledOnce(),
    );
    expect(document.getElementById("lookup-summary")?.textContent).toContain(
      "No ServiceNow tasks synced",
    );
    expect(storage.prefs.frozen).toEqual([DAILY_ACTIVITY_QA]);
    expect(
      document.querySelector<HTMLInputElement>(
        `input[data-type="freeze"][data-key="${DESCRIPTION_COL_KEY}"]`,
      )?.checked,
    ).toBe(true);
  });

  it("shows an error and restores the sync button when the background does not respond", async () => {
    const runtime = chrome.runtime as typeof chrome.runtime & {
      sendMessage: ReturnType<typeof vi.fn>;
    };
    runtime.sendMessage.mockImplementation(() => undefined);
    await loadPopup();

    vi.useFakeTimers();
    document.getElementById("sync-btn")?.click();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(document.getElementById("lookup-summary")?.textContent).toBe(
      "The ServiceNow background process did not respond. Try again.",
    );
    expect(document.getElementById("lookup-summary")?.dataset.state).toBe(
      "error",
    );
    expect(document.getElementById("sync-btn")?.textContent).toBe(
      "Fetch from ServiceNow",
    );
    expect(
      (document.getElementById("sync-btn") as HTMLButtonElement).disabled,
    ).toBe(false);
    vi.useRealTimers();
  });

  it("renders detected rows and toggles row visibility", async () => {
    await loadPopup();

    const rowLabels = Array.from(document.querySelectorAll(".row-label")).map(
      (element) => {
        return element.textContent;
      },
    );
    expect(rowLabels).toEqual(["Scheduled Hours"]);

    const rowFreezeControls = document.querySelectorAll(
      "#row-list input[data-type='freeze']",
    );
    expect(rowFreezeControls.length).toBe(0);

    const visibleToggle = document.querySelector<HTMLInputElement>(
      'input[data-type="row-visible"][data-label="Scheduled Hours"]',
    )!;
    expect(visibleToggle.checked).toBe(true);

    visibleToggle.checked = false;
    visibleToggle.dispatchEvent(new Event("change"));

    await vi.waitFor(() => {
      expect(storage.setRowPrefs).toHaveBeenCalledOnce();
    });
    expect(storage.rowPrefs.hidden).toEqual(["Scheduled Hours"]);
    expect(
      document.querySelector<HTMLInputElement>(
        'input[data-type="row-visible"][data-label="Scheduled Hours"]',
      )?.checked,
    ).toBe(false);
  });

  it("shows row empty state when no rows are detected", async () => {
    const tabs = chrome.tabs as typeof chrome.tabs & {
      sendMessage: ReturnType<typeof vi.fn>;
    };
    tabs.sendMessage.mockImplementation(async (_tabId, message: { type: string }) => {
      if (message.type === "adv:get-columns") {
        return {
          columns: [{ key: DAILY_ACTIVITY_QA, label: "Daily Activity" }],
        };
      }

      if (message.type === "adv:get-rows") {
        return {
          rows: [],
        };
      }

      return {};
    });

    await loadPopup();

    expect(document.getElementById("row-empty-state")?.hidden).toBe(false);
    expect(document.getElementById("row-list")?.hidden).toBe(true);
  });

  it("resets row preferences when reset all settings is clicked", async () => {
    storage.rowPrefs = { hidden: ["Scheduled Hours"] };
    await loadPopup();

    const visibleToggleBefore = document.querySelector<HTMLInputElement>(
      'input[data-type="row-visible"][data-label="Scheduled Hours"]',
    )!;
    expect(visibleToggleBefore.checked).toBe(false);

    document.getElementById("reset-btn")?.click();

    await vi.waitFor(() => {
      expect(storage.resetExtensionData).toHaveBeenCalledOnce();
    });

    expect(storage.rowPrefs.hidden).toEqual([]);
    expect(
      document.querySelector<HTMLInputElement>(
        'input[data-type="row-visible"][data-label="Scheduled Hours"]',
      )?.checked,
    ).toBe(true);
  });
});
