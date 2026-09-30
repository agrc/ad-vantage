import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPreferences,
  onPreferencesChanged,
  updateColumnPrefs,
  updateRowPrefs,
  type Preferences,
} from "./preferences";
import * as storage from "./storage";

vi.mock("./storage", () => {
  return {
    getColumnPrefs: vi.fn(),
    getRowPrefs: vi.fn(),
    setColumnPrefs: vi.fn(),
    setRowPrefs: vi.fn(),
    onColumnPrefsChanged: vi.fn(),
    onRowPrefsChanged: vi.fn(),
  };
});

describe("preferences facade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("coordinates column and row preferences on getPreferences", async () => {
    const mockColumns = { hidden: ["TASK"], frozen: ["DLY_ACTV_CD"] };
    const mockRows = { hidden: ["Scheduled Hours"] };

    vi.mocked(storage.getColumnPrefs).mockResolvedValue(mockColumns);
    vi.mocked(storage.getRowPrefs).mockResolvedValue(mockRows);

    const prefs = await getPreferences();

    expect(prefs).toEqual({
      columns: mockColumns,
      rows: mockRows,
    });
    expect(storage.getColumnPrefs).toHaveBeenCalledOnce();
    expect(storage.getRowPrefs).toHaveBeenCalledOnce();
  });

  it("delegates updateColumnPrefs to storage", async () => {
    const mockColumns = { hidden: ["TASK"], frozen: [] };
    vi.mocked(storage.setColumnPrefs).mockResolvedValue();

    await updateColumnPrefs(mockColumns);

    expect(storage.setColumnPrefs).toHaveBeenCalledWith(mockColumns);
  });

  it("delegates updateRowPrefs to storage", async () => {
    const mockRows = { hidden: ["Scheduled Hours"] };
    vi.mocked(storage.setRowPrefs).mockResolvedValue();

    await updateRowPrefs(mockRows);

    expect(storage.setRowPrefs).toHaveBeenCalledWith(mockRows);
  });

  it("listens to both column and row changes and notifies callback", async () => {
    let colCallback: ((cols: storage.ColumnPrefs) => void) | undefined;
    let rowCallback: ((rows: storage.RowPrefs) => void) | undefined;

    vi.mocked(storage.onColumnPrefsChanged).mockImplementation((cb) => {
      colCallback = cb;
    });
    vi.mocked(storage.onRowPrefsChanged).mockImplementation((cb) => {
      rowCallback = cb;
    });

    const received: Preferences[] = [];
    onPreferencesChanged((prefs) => {
      received.push(prefs);
    });

    expect(colCallback).toBeDefined();
    expect(rowCallback).toBeDefined();

    vi.mocked(storage.getRowPrefs).mockResolvedValue({ hidden: ["Scheduled Hours"] });
    vi.mocked(storage.getColumnPrefs).mockResolvedValue({ hidden: ["TASK"], frozen: [] });

    await colCallback?.({ hidden: ["TASK"], frozen: [] });
    expect(received[0]).toEqual({
      columns: { hidden: ["TASK"], frozen: [] },
      rows: { hidden: ["Scheduled Hours"] },
    });

    await rowCallback?.({ hidden: [] });
    expect(received[1]).toEqual({
      columns: { hidden: ["TASK"], frozen: [] },
      rows: { hidden: [] },
    });
  });
});
