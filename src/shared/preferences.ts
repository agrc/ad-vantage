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
  let pendingUpdate = Promise.resolve();

  const enqueue = (fetchSnapshot: () => Promise<Preferences>) => {
    pendingUpdate = pendingUpdate
      .catch(() => {
        return undefined;
      })
      .then(async () => {
        const prefs = await fetchSnapshot();
        callback(prefs);
      });
  };

  onColumnPrefsChanged((columns) => {
    enqueue(async () => {
      const rows = await getRowPrefs();

      return { columns, rows };
    });
  });

  onRowPrefsChanged((rows) => {
    enqueue(async () => {
      const columns = await getColumnPrefs();

      return { columns, rows };
    });
  });
}
