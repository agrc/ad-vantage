import {
  getLookupData,
  type LookupDataRecord,
  type LookupSearchEntryRecord,
} from "./storage";

export interface LookupSearchEntry {
  taskCode: string;
  description: string;
  searchText: string;
}

export async function loadLookupMap(): Promise<Map<string, string>> {
  try {
    const lookupData = await getLookupData();
    return deserializeLookupMap(lookupData);
  } catch (error) {
    console.warn(
      "[ad-vantage] Failed to load saved lookup data; continuing without description column.",
      { error },
    );
    return new Map();
  }
}

export async function loadLookupEntries(): Promise<LookupSearchEntry[]> {
  try {
    const lookupData = await getLookupData();
    return deserializeLookupEntries(lookupData);
  } catch (error) {
    console.warn(
      "[ad-vantage] Failed to load saved lookup search data; continuing without autocomplete.",
      { error },
    );
    return [];
  }
}

export function serializeLookupData(
  lookupMap: Map<string, string>,
  searchEntries: LookupSearchEntry[] = [],
): LookupDataRecord {
  return {
    entries: Array.from(lookupMap.entries()),
    searchEntries: searchEntries.map(serializeLookupEntry),
    entryCount:
      searchEntries.length > 0 ? searchEntries.length : lookupMap.size,
    uploadedAt: new Date().toISOString(),
  };
}

export function deserializeLookupMap(
  lookupData: LookupDataRecord | null | undefined,
): Map<string, string> {
  if (!lookupData || !Array.isArray(lookupData.entries)) {
    return new Map();
  }

  const entries = lookupData.entries.filter(
    (entry): entry is [string, string] =>
      Array.isArray(entry) &&
      entry.length === 2 &&
      typeof entry[0] === "string" &&
      typeof entry[1] === "string",
  );

  return new Map(entries);
}

export function deserializeLookupEntries(
  lookupData: LookupDataRecord | null | undefined,
): LookupSearchEntry[] {
  const persistedEntries = lookupData?.searchEntries;
  if (Array.isArray(persistedEntries) && persistedEntries.length > 0) {
    return persistedEntries
      .filter(isLookupSearchEntryRecord)
      .map((entry) => ({
        taskCode: entry.taskCode.trim(),
        description: entry.description.trim(),
        searchText: entry.searchText.trim(),
      }))
      .filter((entry) => entry.taskCode.length > 0);
  }

  const lookupMap = deserializeLookupMap(lookupData);
  return Array.from(lookupMap.entries())
    .filter(([taskCode]) => isLikelyTaskCode(taskCode))
    .map(([taskCode, description]) => ({
      taskCode,
      description,
      searchText: [taskCode, description].filter(Boolean).join(" "),
    }));
}

function serializeLookupEntry(
  entry: LookupSearchEntry,
): LookupSearchEntryRecord {
  return {
    taskCode: entry.taskCode.trim(),
    description: entry.description.trim(),
    searchText: entry.searchText.trim(),
  };
}

function isLookupSearchEntryRecord(
  entry: LookupSearchEntryRecord,
): entry is LookupSearchEntryRecord {
  return (
    Boolean(entry) &&
    typeof entry.taskCode === "string" &&
    typeof entry.description === "string" &&
    typeof entry.searchText === "string"
  );
}

function isLikelyTaskCode(value: string): boolean {
  return /^[A-Z][A-Z0-9_-]*\d[\w-]*$/i.test(value.trim());
}
