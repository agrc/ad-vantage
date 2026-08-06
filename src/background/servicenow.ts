import { serializeLookupData } from "../shared/lookup";
import { clearAuthToken, type LookupDataRecord } from "../shared/storage";
import { SERVICE_NOW_BASE_URL, getValidAccessToken } from "./oauth";

const TABLE_PATH = "/api/now/table/pm_project_task";
// Query for active tasks assigned to me, my groups, or as an additional assignee that ended no more than two weeks ago
// Ryan said that he doesn't think that additional_assignee is used but I'm keeping here in case it's used in the future
const TASK_QUERY =
  "active=true" +
  "^end_date>=javascript:gs.daysAgoStart(14)" +
  "^assigned_to=javascript:gs.getUserID()" +
  "^ORassignment_group=javascript:getMyGroups()" +
  "^ORadditional_assignee_listLIKEjavascript:gs.getUserID()";

const PAGE_SIZE = 500;
const MAX_RECORDS = 10_000;
const REQUEST_TIMEOUT_MS = 45_000;

interface ServiceNowTask {
  number?: unknown;
  short_description?: unknown;
}

export async function fetchTaskLookup(): Promise<LookupDataRecord> {
  const records: ServiceNowTask[] = [];
  let offset = 0;

  while (offset < MAX_RECORDS) {
    const page = await fetchPage(offset);
    records.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return mapTaskRecords(records);
}

export function mapTaskRecords(records: ServiceNowTask[]): LookupDataRecord {
  const lookupMap = new Map<string, string>();
  for (const record of records) {
    if (typeof record.number !== "string" || record.number.trim() === "") {
      continue;
    }
    lookupMap.set(
      record.number.trim(),
      typeof record.short_description === "string"
        ? record.short_description.trim()
        : "",
    );
  }

  return serializeLookupData(
    lookupMap,
    Array.from(lookupMap, ([taskCode, description]) => ({
      taskCode,
      description,
      searchText: `${taskCode} ${description}`.trim(),
    })),
  );
}

async function fetchPage(
  offset: number,
  retryUnauthorized = true,
): Promise<ServiceNowTask[]> {
  const token = await getValidAccessToken();
  const url = new URL(`${SERVICE_NOW_BASE_URL}${TABLE_PATH}`);
  url.search = new URLSearchParams({
    sysparm_limit: String(PAGE_SIZE),
    sysparm_offset: String(offset),
    sysparm_fields: "number,short_description",
    sysparm_query: TASK_QUERY,
  }).toString();

  const abortController = new AbortController();
  const timeoutId = setTimeout(
    () => abortController.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: abortController.signal,
    });

    if (response.status === 401) {
      if (retryUnauthorized) {
        await clearAuthToken();
        return fetchPage(offset, false);
      }
      throw new Error("ServiceNow session expired. Fetch again to sign in.");
    }
    if (!response.ok) {
      throw new Error(`ServiceNow task fetch failed (${response.status}).`);
    }

    const payload = (await response.json()) as { result?: unknown };
    if (!Array.isArray(payload.result)) {
      throw new Error("ServiceNow returned an invalid task response.");
    }

    return payload.result as ServiceNowTask[];
  } catch (error) {
    if (abortController.signal.aborted) {
      const timeoutError = new Error(
        "ServiceNow task request timed out. Please try again.",
      ) as Error & { cause: unknown };
      timeoutError.cause = error;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
