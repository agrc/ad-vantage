import {
  getColumnPrefs,
  getRowPrefs,
  onColumnPrefsChanged,
  onRowPrefsChanged,
  setColumnPrefs,
  setRowPrefs,
  type ColumnPrefs,
  type RowPrefs,
  type VisibilityPrefs,
} from "./storage";

export type { ColumnPrefs, RowPrefs, VisibilityPrefs };

export interface Preferences {
  columns: ColumnPrefs;
  rows: RowPrefs;
}

export async function getPreferences(): Promise<Preferences> {
  const [columns, rows] = await Promise.all([
    getColumnPrefs(),
    getRowPrefs(),
  ]);

  return { columns, rows };
}

export async function updateColumnPrefs(prefs: ColumnPrefs): Promise<void> {
  await setColumnPrefs(prefs);
}

export async function updateRowPrefs(prefs: RowPrefs): Promise<void> {
  await setRowPrefs(prefs);
}

export function onPreferencesChanged(
  callback: (prefs: Preferences) => void,
): void {
  onColumnPrefsChanged(async (columns) => {
    const rows = await getRowPrefs();

    callback({ columns, rows });
  });

  onRowPrefsChanged(async (rows) => {
    const columns = await getColumnPrefs();

    callback({ columns, rows });
  });
}
