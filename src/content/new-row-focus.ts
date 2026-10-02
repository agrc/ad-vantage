import { getEnhanceableGrids, isDailyActivityGrid } from "./grid-dom";

const ADD_RECORD_BUTTON_SELECTOR = 'button[aria-label="Add Record"]';
const DAILY_ACTIVITY_INPUT_SELECTOR = 'input[data-qa$=".DLY_ACTV_CD"]';
const PENDING_FOCUS_TIMEOUT_MS = 5000;

interface ActivityEditor {
  row: HTMLTableRowElement;
  input: HTMLInputElement;
}

interface PendingFocus {
  rows: Set<HTMLTableRowElement>;
  inputs: Set<HTMLInputElement>;
}

export interface DailyActivityRowFocusController {
  addRow: () => boolean;
  sync: () => void;
  dispose: () => void;
}

export function createDailyActivityRowFocusController(
  root: Document = document,
): DailyActivityRowFocusController {
  let pendingFocus: PendingFocus | null = null;
  let pendingTimeout: number | undefined;

  const getDailyActivityGrids = () =>
    getEnhanceableGrids(root).filter(isDailyActivityGrid);

  const getActivityEditors = (
    grids: HTMLElement[] = getDailyActivityGrids(),
  ): ActivityEditor[] =>
    grids.flatMap((grid) =>
      Array.from(
        grid.querySelectorAll<HTMLInputElement>(DAILY_ACTIVITY_INPUT_SELECTOR),
      ).flatMap((input) => {
        const row = input.closest<HTMLTableRowElement>("tr");
        return row && !input.disabled && !input.readOnly
          ? [{ row, input }]
          : [];
      }),
    );

  const clearPendingFocus = () => {
    if (pendingTimeout !== undefined) {
      root.defaultView?.clearTimeout(pendingTimeout);
      pendingTimeout = undefined;
    }
    pendingFocus = null;
  };

  const onAddRecordClick = (event: MouseEvent) => {
    const view = root.defaultView;
    const target = event.target;
    if (!view || !(target instanceof view.Element)) return;
    if (!target.closest(ADD_RECORD_BUTTON_SELECTOR)) return;

    const grids = getDailyActivityGrids();
    if (grids.length === 0) return;

    const editors = getActivityEditors(grids);
    pendingFocus = {
      rows: new Set(editors.map(({ row }) => row)),
      inputs: new Set(editors.map(({ input }) => input)),
    };
    if (pendingTimeout !== undefined) view.clearTimeout(pendingTimeout);
    pendingTimeout = view.setTimeout(() => {
      pendingFocus = null;
      pendingTimeout = undefined;
    }, PENDING_FOCUS_TIMEOUT_MS);
  };

  root.addEventListener("click", onAddRecordClick, true);

  return {
    addRow() {
      if (getDailyActivityGrids().length === 0) return false;

      const button = root.querySelector<HTMLButtonElement>(
        ADD_RECORD_BUTTON_SELECTOR,
      );
      if (
        !button ||
        button.disabled ||
        button.getAttribute("aria-disabled") === "true"
      ) {
        return false;
      }

      button.click();
      return true;
    },
    sync() {
      if (!pendingFocus) return;

      const editors = getActivityEditors();
      const newRowEditor = [...editors]
        .reverse()
        .find(({ row }) => !pendingFocus!.rows.has(row));
      const newEditor = [...editors]
        .reverse()
        .find(({ input }) => !pendingFocus!.inputs.has(input));
      const editor = newRowEditor ?? newEditor;
      if (!editor) return;

      editor.row.scrollIntoView({ block: "nearest" });
      editor.input.focus({ preventScroll: true });
      clearPendingFocus();
    },
    dispose() {
      root.removeEventListener("click", onAddRecordClick, true);
      clearPendingFocus();
    },
  };
}