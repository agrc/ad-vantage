import { DAILY_ACTIVITY_QA, DESCRIPTION_COL_KEY } from "../shared/constants";
import type { ColumnPrefs } from "../shared/storage";
import {
  createPrefsWriter,
  setVisibility,
  type PrefsWriter,
} from "./visibility-prefs";

export type ColumnPrefsWriter = PrefsWriter<ColumnPrefs>;

export function createColumnPrefsWriter(
  persist: (prefs: ColumnPrefs) => Promise<void>,
): ColumnPrefsWriter {
  return createPrefsWriter(persist);
}

export function setColumnVisibility(
  prefs: ColumnPrefs,
  key: string,
  visible: boolean,
): ColumnPrefs {
  return setVisibility(prefs, key, visible);
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
