import { DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY } from "../shared/constants";
import type { ColumnPrefs } from "../shared/storage";

export interface ColumnPrefsWriter {
  write: (prefs: ColumnPrefs) => Promise<void>;
}

export function createColumnPrefsWriter(
  persist: (prefs: ColumnPrefs) => Promise<void>,
): ColumnPrefsWriter {
  let pendingWrite = Promise.resolve();

  return {
    write(prefs) {
      const write = pendingWrite
        .catch(() => undefined)
        .then(() => persist(prefs));
      pendingWrite = write;
      return write;
    },
  };
}

export function setColumnVisibility(
  prefs: ColumnPrefs,
  key: string,
  visible: boolean,
): ColumnPrefs {
  const hidden = visible
    ? prefs.hidden.filter((hiddenKey) => hiddenKey !== key)
    : prefs.hidden.includes(key)
      ? [...prefs.hidden]
      : [...prefs.hidden, key];

  return { hidden, frozen: [...prefs.frozen] };
}

export function setColumnFrozen(
  prefs: ColumnPrefs,
  key: string,
  frozen: boolean,
): ColumnPrefs {
  let frozenKeys = frozen
    ? prefs.frozen.includes(key)
      ? [...prefs.frozen]
      : [...prefs.frozen, key]
    : prefs.frozen.filter((frozenKey) => frozenKey !== key);

  if (
    frozen &&
    key === DESCRIPTION_COL_KEY &&
    !frozenKeys.includes(DAILY_ACTIVITY_QA)
  ) {
    frozenKeys = [DAILY_ACTIVITY_QA, ...frozenKeys];
  }

  if (!frozen && key === DAILY_ACTIVITY_QA) {
    frozenKeys = frozenKeys.filter(
      (frozenKey) => frozenKey !== DESCRIPTION_COL_KEY,
    );
  }

  return { hidden: [...prefs.hidden], frozen: frozenKeys };
}
