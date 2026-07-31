import {
  DAILY_ACTIVITY_QA,
  DESCRIPTION_COL_KEY,
  LEGACY_DAILY_ACTIVITY_QA,
} from "./constants";

export interface ColumnPrefs {
  hidden: string[];
  frozen: string[];
}

export interface LookupSearchEntryRecord {
  taskCode: string;
  description: string;
  searchText: string;
}

export interface LookupDataRecord {
  entries: Array<[string, string]>;
  searchEntries?: LookupSearchEntryRecord[];
  entryCount: number;
  uploadedAt: string;
}

export interface AuthTokenRecord {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface StoredColumnPrefs extends ColumnPrefs {
  schemaVersion?: number;
}

const PREFS_KEY = "columnPrefs";
const PREFS_SCHEMA_VERSION = 3;
const LOOKUP_DATA_KEY = "lookupData";
const AUTH_TOKEN_KEY = "serviceNowAuth";

const DEFAULT_COLUMN_PREFS: ColumnPrefs = {
  hidden: [],
  frozen: [DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY],
};

function getDefaultColumnPrefs(): ColumnPrefs {
  return normalizeColumnPrefs(DEFAULT_COLUMN_PREFS);
}

function normalizeColumnPrefs(
  prefs: Partial<ColumnPrefs> | null | undefined,
  options?: { migrateLegacyDescriptionVisibility?: boolean },
): ColumnPrefs {
  const hidden = Array.isArray(prefs?.hidden)
    ? normalizeColumnKeys(prefs.hidden)
    : [];
  const frozen = Array.isArray(prefs?.frozen)
    ? normalizeColumnKeys(prefs.frozen)
    : [];

  if (options?.migrateLegacyDescriptionVisibility) {
    const descriptionHiddenIndex = hidden.indexOf(DESCRIPTION_COL_KEY);
    if (descriptionHiddenIndex !== -1) {
      hidden.splice(descriptionHiddenIndex, 1);
    }
  }

  if (
    frozen.includes(DESCRIPTION_COL_KEY) &&
    !frozen.includes(DAILY_ACTIVITY_QA)
  ) {
    frozen.unshift(DAILY_ACTIVITY_QA);
  }

  return { hidden, frozen };
}

function normalizeColumnKeys(keys: unknown[]): string[] {
  return [
    ...new Set(
      keys
        .filter((key): key is string => typeof key === "string")
        .map((key) => {
          if (key === LEGACY_DAILY_ACTIVITY_QA) {
            return DAILY_ACTIVITY_QA;
          }

          return key;
        }),
    ),
  ];
}

function serializeColumnPrefs(prefs: ColumnPrefs): StoredColumnPrefs {
  return {
    ...normalizeColumnPrefs(prefs),
    schemaVersion: PREFS_SCHEMA_VERSION,
  };
}

function shouldMigrateLegacyPrefs(
  prefs: StoredColumnPrefs | undefined,
): boolean {
  return prefs?.schemaVersion !== PREFS_SCHEMA_VERSION;
}

export async function getColumnPrefs(): Promise<ColumnPrefs> {
  const storedPrefs = await getStorageValue<StoredColumnPrefs>(
    chrome.storage.sync,
    PREFS_KEY,
  );
  const normalizedPrefs = normalizeColumnPrefs(
    storedPrefs ?? getDefaultColumnPrefs(),
    {
      migrateLegacyDescriptionVisibility: shouldMigrateLegacyPrefs(storedPrefs),
    },
  );

  if (shouldMigrateLegacyPrefs(storedPrefs)) {
    await setStorageValue(
      chrome.storage.sync,
      PREFS_KEY,
      serializeColumnPrefs(normalizedPrefs),
    );
  }

  return normalizedPrefs;
}

export async function setColumnPrefs(prefs: ColumnPrefs): Promise<void> {
  await setStorageValue(
    chrome.storage.sync,
    PREFS_KEY,
    serializeColumnPrefs(prefs),
  );
}

export function onColumnPrefsChanged(
  callback: (prefs: ColumnPrefs) => void,
): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && PREFS_KEY in changes) {
      const nextPrefs = changes[PREFS_KEY].newValue as
        | StoredColumnPrefs
        | undefined;
      callback(
        normalizeColumnPrefs(nextPrefs ?? getDefaultColumnPrefs(), {
          migrateLegacyDescriptionVisibility:
            shouldMigrateLegacyPrefs(nextPrefs),
        }),
      );
    }
  });
}

export async function getLookupData(): Promise<LookupDataRecord | null> {
  const lookupData = await getStorageValue<unknown>(
    chrome.storage.local,
    LOOKUP_DATA_KEY,
  );
  return isLookupDataRecord(lookupData) ? cloneLookupData(lookupData) : null;
}

export async function setLookupData(data: LookupDataRecord): Promise<void> {
  await setStorageValue(chrome.storage.local, LOOKUP_DATA_KEY, data);
}

export function onLookupDataChanged(
  callback: (lookupData: LookupDataRecord | null) => void,
): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && LOOKUP_DATA_KEY in changes) {
      const nextLookupData = changes[LOOKUP_DATA_KEY].newValue as
        | LookupDataRecord
        | undefined;
      callback(nextLookupData ?? null);
    }
  });
}

export async function getAuthToken(): Promise<AuthTokenRecord | null> {
  const token = await getStorageValue<unknown>(
    chrome.storage.session,
    AUTH_TOKEN_KEY,
  );
  return isAuthTokenRecord(token) ? { ...token } : null;
}

export async function setAuthToken(token: AuthTokenRecord): Promise<void> {
  await setStorageValue(chrome.storage.session, AUTH_TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  await removeStorageValue(chrome.storage.session, AUTH_TOKEN_KEY);
}

export async function resetExtensionData(): Promise<void> {
  await Promise.all([
    removeStorageValue(chrome.storage.sync, PREFS_KEY),
    removeStorageValue(chrome.storage.local, LOOKUP_DATA_KEY),
    removeStorageValue(chrome.storage.session, AUTH_TOKEN_KEY),
  ]);
}

function getStorageValue<T>(
  storageArea: chrome.storage.StorageArea,
  key: string,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    storageArea.get(key, (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result[key] as T | undefined);
    });
  });
}

function setStorageValue(
  storageArea: chrome.storage.StorageArea,
  key: string,
  value: unknown,
): Promise<void> {
  return new Promise((resolve, reject) => {
    storageArea.set({ [key]: value }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

function removeStorageValue(
  storageArea: chrome.storage.StorageArea,
  key: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    storageArea.remove(key, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

function isAuthTokenRecord(value: unknown): value is AuthTokenRecord {
  if (!value || typeof value !== "object") return false;

  const token = value as Partial<AuthTokenRecord>;
  return (
    typeof token.accessToken === "string" &&
    typeof token.refreshToken === "string" &&
    typeof token.expiresAt === "number" &&
    Number.isFinite(token.expiresAt)
  );
}

function isLookupDataRecord(value: unknown): value is LookupDataRecord {
  if (!value || typeof value !== "object") return false;

  const record = value as Partial<LookupDataRecord>;
  return (
    Array.isArray(record.entries) &&
    record.entries.every(
      (entry) =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === "string" &&
        typeof entry[1] === "string",
    ) &&
    (record.searchEntries === undefined ||
      (Array.isArray(record.searchEntries) &&
        record.searchEntries.every(
          (entry) =>
            Boolean(entry) &&
            typeof entry.taskCode === "string" &&
            typeof entry.description === "string" &&
            typeof entry.searchText === "string",
        ))) &&
    typeof record.entryCount === "number" &&
    Number.isFinite(record.entryCount) &&
    typeof record.uploadedAt === "string"
  );
}

function cloneLookupData(data: LookupDataRecord): LookupDataRecord {
  return {
    ...data,
    entries: data.entries.map(([taskCode, description]) => [
      taskCode,
      description,
    ]),
    searchEntries: data.searchEntries?.map((entry) => ({ ...entry })),
  };
}
