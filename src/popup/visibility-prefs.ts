import type { VisibilityPrefs } from "../shared/storage";

export interface PrefsWriter<T> {
  write: (prefs: T) => Promise<void>;
}

export function createPrefsWriter<T>(
  persist: (prefs: T) => Promise<void>,
): PrefsWriter<T> {
  let pendingWrite = Promise.resolve();

  return {
    write(prefs) {
      const write = pendingWrite
        .catch(() => {
          return undefined;
        })
        .then(() => {
          return persist(prefs);
        });

      pendingWrite = write;

      return write;
    },
  };
}

export function setVisibility<T extends VisibilityPrefs>(
  prefs: T,
  key: string,
  visible: boolean,
): T {
  const hidden = visible
    ? prefs.hidden.filter((hiddenKey) => {
        return hiddenKey !== key;
      })
    : prefs.hidden.includes(key)
      ? [...prefs.hidden]
      : [...prefs.hidden, key];

  return {
    ...prefs,
    hidden,
  };
}
