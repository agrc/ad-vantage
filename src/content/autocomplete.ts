import type { LookupSearchEntry } from "../shared/lookup";

const MAX_AUTOCOMPLETE_RESULTS = 8;

export interface AutocompleteLookupEntry extends LookupSearchEntry {
  normalizedTaskCode: string;
  normalizedDescription: string;
  normalizedSearchText: string;
}

export function buildAutocompleteEntries(
  entries: LookupSearchEntry[],
): AutocompleteLookupEntry[] {
  return entries
    .filter((entry) => entry.taskCode.trim().length > 0)
    .map((entry) => ({
      ...entry,
      normalizedTaskCode: normalizeSearchValue(entry.taskCode),
      normalizedDescription: normalizeSearchValue(entry.description),
      normalizedSearchText: normalizeSearchValue(entry.searchText),
    }));
}

export function getAutocompleteSuggestions(
  entries: AutocompleteLookupEntry[],
  query: string,
): AutocompleteLookupEntry[] {
  const normalizedQuery = normalizeSearchValue(query);
  if (normalizedQuery.length === 0) return [];

  return entries
    .map((entry) => ({
      entry,
      score: getAutocompleteScore(entry, normalizedQuery),
    }))
    .filter((result) => result.score !== Number.POSITIVE_INFINITY)
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score;
      if (left.entry.description.length !== right.entry.description.length) {
        return left.entry.description.length - right.entry.description.length;
      }
      return left.entry.taskCode.localeCompare(right.entry.taskCode);
    })
    .slice(0, MAX_AUTOCOMPLETE_RESULTS)
    .map((result) => result.entry);
}

function getAutocompleteScore(
  entry: AutocompleteLookupEntry,
  normalizedQuery: string,
): number {
  if (entry.normalizedDescription === normalizedQuery) return 0;
  if (entry.normalizedTaskCode === normalizedQuery) return 1;
  if (entry.normalizedDescription.startsWith(normalizedQuery)) return 2;
  if (entry.normalizedTaskCode.startsWith(normalizedQuery)) return 3;

  const descriptionIndex = entry.normalizedDescription.indexOf(normalizedQuery);
  if (descriptionIndex !== -1) return 10 + descriptionIndex;

  const searchIndex = entry.normalizedSearchText.indexOf(normalizedQuery);
  return searchIndex === -1 ? Number.POSITIVE_INFINITY : 100 + searchIndex;
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
