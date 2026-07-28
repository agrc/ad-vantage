import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthToken,
  getAuthToken,
  getColumnPrefs,
  getLookupData,
  setAuthToken,
  setColumnPrefs,
  setLookupData,
  type AuthTokenRecord,
  type LookupDataRecord,
} from "./storage";

const authToken: AuthTokenRecord = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: 1_800_000_000_000,
};

const lookupData: LookupDataRecord = {
  entries: [["TASK-1", "Replace monitor"]],
  entryCount: 1,
  uploadedAt: "2026-07-28T00:00:00.000Z",
};

const local = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
};
const session = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
};
const sync = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
};

vi.stubGlobal("chrome", {
  storage: {
    local,
    session,
    sync,
    onChanged: { addListener: vi.fn() },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("storage areas", () => {
  it("stores OAuth tokens only in session storage", async () => {
    session.get.mockImplementation((_key, callback) => {
      callback({ serviceNowAuth: authToken });
    });
    session.set.mockImplementation((_values, callback) => callback());
    session.remove.mockImplementation((_key, callback) => callback());

    await expect(getAuthToken()).resolves.toEqual(authToken);
    await setAuthToken(authToken);
    await clearAuthToken();

    expect(session.get).toHaveBeenCalledWith(
      "serviceNowAuth",
      expect.any(Function),
    );
    expect(session.set).toHaveBeenCalledWith(
      { serviceNowAuth: authToken },
      expect.any(Function),
    );
    expect(session.remove).toHaveBeenCalledWith(
      "serviceNowAuth",
      expect.any(Function),
    );
    expect(local.get).not.toHaveBeenCalled();
    expect(local.set).not.toHaveBeenCalled();
    expect(local.remove).not.toHaveBeenCalled();
  });

  it("rejects malformed session tokens", async () => {
    session.get.mockImplementation((_key, callback) => {
      callback({ serviceNowAuth: { accessToken: "access-token" } });
    });

    await expect(getAuthToken()).resolves.toBeNull();
  });

  it("keeps lookup data in local storage", async () => {
    local.get.mockImplementation((_key, callback) => {
      callback({ lookupData });
    });
    local.set.mockImplementation((_values, callback) => callback());

    await expect(getLookupData()).resolves.toEqual(lookupData);
    await setLookupData(lookupData);

    expect(local.get).toHaveBeenCalledWith("lookupData", expect.any(Function));
    expect(local.set).toHaveBeenCalledWith(
      { lookupData },
      expect.any(Function),
    );
    expect(session.get).not.toHaveBeenCalled();
    expect(session.set).not.toHaveBeenCalled();
  });

  it("keeps preferences in sync storage", async () => {
    const prefs = { hidden: ["TASK"], frozen: ["DLY_ACTV_CD"] };
    sync.get.mockImplementation((_key, callback) => {
      callback({ columnPrefs: { ...prefs, schemaVersion: 3 } });
    });
    sync.set.mockImplementation((_values, callback) => callback?.());

    await expect(getColumnPrefs()).resolves.toEqual(prefs);
    await setColumnPrefs(prefs);

    expect(sync.get).toHaveBeenCalledWith("columnPrefs", expect.any(Function));
    expect(sync.set).toHaveBeenCalledWith(
      { columnPrefs: { ...prefs, schemaVersion: 3 } },
      expect.any(Function),
    );
  });
});
