import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY } from "../shared/constants";
import type { ColumnPrefs, LookupDataRecord } from "../shared/storage";

const storage = vi.hoisted(() => ({
  prefs: { hidden: [] as string[], frozen: [] as string[] },
  lookup: null as LookupDataRecord | null,
  getColumnPrefs: vi.fn(),
  getLookupData: vi.fn(),
  setColumnPrefs: vi.fn(),
  resetExtensionData: vi.fn(),
}));

vi.mock("../shared/storage", async (importOriginal) => {
  const original = await importOriginal<typeof import("../shared/storage")>();
  return {
    ...original,
    getColumnPrefs: storage.getColumnPrefs,
    getLookupData: storage.getLookupData,
    setColumnPrefs: storage.setColumnPrefs,
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
    <button id="reset-btn">Reset All Settings</button>
  `;
}

function clonePrefs(): ColumnPrefs {
  return {
    hidden: [...storage.prefs.hidden],
    frozen: [...storage.prefs.frozen],
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
  storage.lookup = {
    entries: [["PRJ-1", "Monitor"]],
    entryCount: 1,
    uploadedAt: "2026-01-01T00:00:00.000Z",
  };
  storage.getColumnPrefs
    .mockReset()
    .mockImplementation(async () => clonePrefs());
  storage.getLookupData
    .mockReset()
    .mockImplementation(async () => storage.lookup);
  storage.setColumnPrefs
    .mockReset()
    .mockImplementation(async (prefs: ColumnPrefs) => {
      storage.prefs = { hidden: [...prefs.hidden], frozen: [...prefs.frozen] };
    });
  storage.resetExtensionData.mockReset().mockImplementation(async () => {
    storage.lookup = null;
  });

  vi.stubGlobal("chrome", {
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
      getManifest: vi.fn(() => ({
        name: "ad-vantage (Pre-release)",
        version: "1.2.3",
        icons: { "48": "icons/pre-release/icon48.png" },
      })),
      sendMessage: vi.fn((_message, callback) => callback({ ok: true })),
      lastError: undefined,
    },
    tabs: {
      query: vi.fn(async () => [{ id: 7 }]),
      sendMessage: vi.fn(async () => ({
        columns: [
          { key: DAILY_ACTIVITY_QA, label: "Daily Activity" },
          { key: "Mon", label: "Mon" },
        ],
      })),
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
});
