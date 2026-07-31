export const GET_COLUMNS_MESSAGE_TYPE = "adv:get-columns";
export const SERVICE_NOW_SYNC_MESSAGE_TYPE = "adv:servicenow-sync";

export interface ColumnInfo {
  key: string;
  label: string;
}

export interface GetColumnsRequest {
  type: typeof GET_COLUMNS_MESSAGE_TYPE;
}

export interface GetColumnsResponse {
  columns: ColumnInfo[];
}

export interface ServiceNowSyncRequest {
  type: typeof SERVICE_NOW_SYNC_MESSAGE_TYPE;
}

export type ServiceNowSyncResponse =
  | { ok: true; entryCount: number }
  | { ok: false; error: string };

export function isGetColumnsRequest(
  value: unknown,
): value is GetColumnsRequest {
  return hasMessageType(value, GET_COLUMNS_MESSAGE_TYPE);
}

export function isGetColumnsResponse(
  value: unknown,
): value is GetColumnsResponse {
  if (!value || typeof value !== "object") return false;

  const response = value as Partial<GetColumnsResponse>;
  return (
    Array.isArray(response.columns) && response.columns.every(isColumnInfo)
  );
}

export function isServiceNowSyncRequest(
  value: unknown,
): value is ServiceNowSyncRequest {
  return hasMessageType(value, SERVICE_NOW_SYNC_MESSAGE_TYPE);
}

function hasMessageType(value: unknown, type: string): boolean {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as { type?: unknown }).type === type
  );
}

function isColumnInfo(value: unknown): value is ColumnInfo {
  if (!value || typeof value !== "object") return false;

  const column = value as Partial<ColumnInfo>;
  return typeof column.key === "string" && typeof column.label === "string";
}
